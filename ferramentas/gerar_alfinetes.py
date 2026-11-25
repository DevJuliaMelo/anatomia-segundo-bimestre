"""Gera as imagens do Modo Alfinete a partir dos PDFs das aulas.

Passos:
  1. Renderiza cada slide da curadoria em alta resolução (2400 px de largura).
  2. Usa o resultado do OCR (ocr_resultado.json, gerado por ocr_windows.ps1)
     para saber onde estão as legendas.
  3. Recorta a figura, calcula as tarjas (legendas escondidas) e os alfinetes.
  4. Escreve img/alfinetes/<id>.jpg e js/dados-alfinetes.js.

Uso (na pasta do projeto):
    pip install pypdfium2 pillow
    python ferramentas/gerar_alfinetes.py [--previa pasta_de_previas]
"""
import glob
import json
import os
import sys

import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FERR = os.path.join(RAIZ, "ferramentas")
LARG_FULL, ALT_FULL = 2400, 1350
LARG_MAX = 1400
PAD_X, PAD_Y = 16, 7  # folga das tarjas (px na imagem de 2400)


def carregar_ocr():
    with open(os.path.join(FERR, "ocr_resultado.json"), encoding="utf-8-sig") as f:
        bruto = json.load(f)
    ocr = {}
    for chave, linhas in bruto.items():
        if isinstance(linhas, dict):
            linhas = [linhas]
        res = []
        for l in linhas:
            w = l["w"]
            if w and not isinstance(w[0], list):
                w = [w]
            res.append({"t": l["t"], "w": w})
        ocr[chave] = res
    return ocr


def caixa_palavras(palavras):
    x0 = min(p[1] for p in palavras)
    y0 = min(p[2] for p in palavras)
    x1 = max(p[1] + p[3] for p in palavras)
    y1 = max(p[2] + p[4] for p in palavras)
    return [x0 - PAD_X, y0 - PAD_Y, x1 + PAD_X, y1 + PAD_Y]


def caixa_spec(linhas, spec):
    """spec: int (linha), lista de ints, ou 'linha.a-b' (intervalo de palavras)."""
    itens = spec if isinstance(spec, list) else [spec]
    caixas, usadas = [], set()
    for it in itens:
        if isinstance(it, str):
            li, faixa = it.split(".")
            li = int(li)
            a, _, b = faixa.partition("-")
            a = int(a)
            b = int(b) if b else a
            caixas.append(caixa_palavras(linhas[li]["w"][a:b + 1]))
            usadas.add(li)
        else:
            caixas.append(caixa_palavras(linhas[it]["w"]))
            usadas.add(it)
    return caixas, usadas


def unir(caixas):
    return [min(c[0] for c in caixas), min(c[1] for c in caixas),
            max(c[2] for c in caixas), max(c[3] for c in caixas)]


def pdfs_por_aula():
    mapa = {}
    for f in glob.glob(os.path.join(RAIZ, "*.pdf")):
        mapa[os.path.basename(f).split("_")[0]] = f
    return mapa


def main():
    previa = None
    if "--previa" in sys.argv:
        previa = sys.argv[sys.argv.index("--previa") + 1]
        os.makedirs(previa, exist_ok=True)

    with open(os.path.join(FERR, "curadoria.json"), encoding="utf-8") as f:
        curadoria = json.load(f)
    ocr = carregar_ocr()
    pdfs = pdfs_por_aula()
    docs = {}
    saida_img = os.path.join(RAIZ, "img", "alfinetes")
    os.makedirs(saida_img, exist_ok=True)
    fonte = ImageFont.truetype("arialbd.ttf", 22)

    dados = []
    for s in curadoria:
        aula, pag = s["id"].split("_")
        if aula not in docs:
            docs[aula] = pdfium.PdfDocument(pdfs[aula])
        p = docs[aula][int(pag) - 1]
        img = p.render(scale=LARG_FULL / p.get_width()).to_pil().convert("RGB")
        linhas = ocr[s["id"]]

        cx0, cy0, cx1, cy1 = [v / 100 for v in s["crop"]]
        cx0, cx1 = cx0 * LARG_FULL, cx1 * LARG_FULL
        cy0, cy1 = cy0 * ALT_FULL, cy1 * ALT_FULL
        cw, ch = cx1 - cx0, cy1 - cy0

        def rel(c):
            x0 = max(c[0], cx0); y0 = max(c[1], cy0)
            x1 = min(c[2], cx1); y1 = min(c[3], cy1)
            return [round((x0 - cx0) / cw * 100, 2), round((y0 - cy0) / ch * 100, 2),
                    round((x1 - x0) / cw * 100, 2), round((y1 - y0) / ch * 100, 2)]

        def dentro(c):
            return c[2] > cx0 and c[0] < cx1 and c[3] > cy0 and c[1] < cy1

        pins, usadas = [], set()
        for i, pin in enumerate(s["pins"]):
            resposta, spec = pin[0], pin[1]
            alts = pin[2] if len(pin) > 2 else []
            caixas, us = caixa_spec(linhas, spec)
            usadas |= us
            caixa = rel(unir(caixas))
            if caixa[2] <= 0 or caixa[3] <= 0:
                print(f"AVISO {s['id']}: alfinete '{resposta}' fora do recorte")
                continue
            pins.append({"n": len(pins) + 1, "a": resposta, "alts": alts, "box": caixa})

        keep = set(s.get("keep", []))
        mascaras = []
        for i, l in enumerate(linhas):
            if i in usadas or i in keep:
                continue
            c = caixa_palavras(l["w"])
            if dentro(c):
                mascaras.append(rel(c))

        recorte = img.crop((int(cx0), int(cy0), int(cx1), int(cy1)))
        if recorte.width > LARG_MAX:
            recorte = recorte.resize((LARG_MAX, round(recorte.height * LARG_MAX / recorte.width)), Image.LANCZOS)
        recorte.save(os.path.join(saida_img, s["id"] + ".jpg"), quality=78, optimize=True)

        dados.append({"id": s["id"], "sys": s["sys"], "t": s["t"],
                      "img": "img/alfinetes/" + s["id"] + ".jpg",
                      "w": recorte.width, "h": recorte.height,
                      "pins": pins, "masks": mascaras})

        if previa:
            pv = recorte.copy()
            d = ImageDraw.Draw(pv)
            W, H = pv.size
            for m in mascaras:
                d.rectangle([m[0] * W / 100, m[1] * H / 100, (m[0] + m[2]) * W / 100, (m[1] + m[3]) * H / 100], fill=(190, 190, 190))
            for pin in pins:
                b = pin["box"]
                d.rectangle([b[0] * W / 100, b[1] * H / 100, (b[0] + b[2]) * W / 100, (b[1] + b[3]) * H / 100], fill=(255, 230, 120), outline=(200, 0, 0))
                d.text((b[0] * W / 100 + 3, b[1] * H / 100), f'{pin["n"]}', fill=(200, 0, 0), font=fonte)
            pv.save(os.path.join(previa, s["id"] + ".jpg"), quality=70)

    with open(os.path.join(RAIZ, "js", "dados-alfinetes.js"), "w", encoding="utf-8") as f:
        f.write("// Gerado por ferramentas/gerar_alfinetes.py — não edite à mão.\n")
        f.write("window.DADOS_ALFINETES = ")
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    total = sum(len(d["pins"]) for d in dados)
    print(f"{len(dados)} imagens, {total} alfinetes")


if __name__ == "__main__":
    main()
