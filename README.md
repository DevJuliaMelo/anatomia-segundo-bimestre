# 📍 Anatomia: Revisão

App de estudo para a prova **prática e teórica** de anatomia (aulas 7 a 12):
sistemas cardiovascular, respiratório, digestório, urinário, endócrino e nervoso.

## Como usar

**No computador:** baixe a pasta e abra o `index.html` no navegador. Não precisa instalar nada.

**Pelo link (GitHub Pages):** no repositório, vá em *Settings → Pages → Branch: main / (root) → Save*.
Em 1 ou 2 minutos o site fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/` e funciona também no celular.

## Modos

| Modo | Para quê |
|---|---|
| 📖 **Aprender** (comece aqui) | 40 aulas curtas por tema. Cada uma tem resumo do slide e macete, tour guiado na figura (os nomes aparecem um por um) e 3 perguntas para checar. |
| 📍 **Alfinete** | Simula a prova prática: a legenda some, um alfinete pisca e você digita o nome da estrutura. Aceita respostas sem acento e avisa quando é só erro de grafia, mas troca de lado (direito/esquerdo, superior/inferior…) conta como erro. |
| 🗺️ **Atlas** | Todas as 63 imagens. Clique nas tarjas para revelar e depois teste só aquela imagem. |
| 🃏 **Flashcards** | Cerca de 390 perguntas com repetição espaçada: o que você erra volta logo, o que é fácil demora a voltar. |
| 🧠 **Quiz** | Múltipla escolha, verdadeiro ou falso (pegadinhas comuns), sequências (caminho do ar, da urina, do sangue…) e ligar colunas (hormônio ↔ glândula, lobo ↔ função…). |
| 📝 **Simulado** | Prova mista com nota de 0 a 10 e lista do que você errou. |
| 🎯 **Meus erros** | Tudo o que você errou e ainda não dominou, com botão para treinar só isso. |

Use os botões de sistema no topo para estudar um sistema por vez.
O progresso fica salvo **no seu navegador**: cada pessoa tem o seu.

## Plano sugerido (3 dias)

1. **Dia 1:** modo Aprender em todos os sistemas e uma rodada de flashcards.
2. **Dia 2:** Modo Alfinete, um sistema por vez, e Quiz de V/F e ligar colunas.
3. **Dia 3:** "Meus erros" até zerar e 2 simulados completos.

## Pontos para confirmar com a professora

Em alguns slides o texto difere da literatura. No app, as perguntas sobre esses pontos avisam isso:
- **Esfíncteres do ânus (aula 9, slide 41):** o slide diz interno = voluntário e externo = involuntário. Na anatomia é o contrário.
- **Células de Purkinje e piramidais (aula 12, slide 30):** as localizações aparecem trocadas. Purkinje fica no cerebelo; piramidal fica no córtex cerebral.
- **ADH e ocitocina (aula 11):** o slide 14 diz que a neuro-hipófise "produz", mas eles são produzidos no hipotálamo e armazenados/liberados pela neuro-hipófise (como diz o slide 41).

## Estrutura do projeto

```
index.html              página do app
css/estilo.css          visual
js/app.js               lógica (modos, correção, repetição espaçada)
js/dados-teoria.js      flashcards, V/F, sequências e ligar colunas (edite aqui para acrescentar perguntas)
js/dados-aprender.js    aulas do modo Aprender (resumos, macetes, imagem do tour)
js/dados-alfinetes.js   gerado automaticamente: posição dos alfinetes
img/alfinetes/          recortes das figuras dos slides
ferramentas/            scripts Python que geraram as imagens e os alfinetes
```

### Regerar as imagens (opcional)

Os PDFs das aulas **não** vão para o repositório (estão no `.gitignore`). Se quiser regerar:

```bash
pip install pypdfium2 pillow
# coloque os PDFs das aulas na pasta raiz e rode:
python ferramentas/gerar_alfinetes.py
```

- `ferramentas/curadoria.json` define, para cada slide, o recorte, quais legendas viram alfinetes e as respostas aceitas.
- `ferramentas/ocr_resultado.json` guarda a posição de cada legenda. Ela foi lida com o OCR do próprio Windows (`ferramentas/ocr_windows.ps1`).

## Aviso

As figuras são dos slides das aulas, que usam imagens de livros e atlas de anatomia. O app serve apenas para estudo da turma.
Se for publicar, prefira um **repositório privado** com os colegas como colaboradores, ou confirme com a professora antes de deixar público.
