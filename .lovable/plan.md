## Objetivo
Aplicar um gradiente transiente na logo TEAmo: o "TEA" começa azul (primary), e a transição para rosa (accent) acontece suavemente, ficando totalmente rosa apenas perto do "mo".

## Mudança
Editar apenas `src/components/layout/BrandLogo.tsx`:

- Remover a separação em dois `<span>` (azul puro + rosa puro).
- Renderizar "TEAmo" como uma única palavra com `bg-clip-text text-transparent` aplicado sobre um `linear-gradient` horizontal usando os tokens existentes `--primary` (azul) e `--accent` (rosa).
- Distribuir os stops para que ~80% do percurso permaneça azul e a transição rosa apareça só no fim:

  ```
  background-image: linear-gradient(
    90deg,
    var(--primary) 0%,
    var(--primary) 60%,
    var(--accent) 100%
  );
  ```

  O ponto 60% garante azul sólido cobrindo todo "TEA" e início do "m"; daí até 100% ocorre a transição suave que termina rosa em "o".
- Manter `aria-label="TEAmo"` para acessibilidade (gradient + bg-clip esconde o texto visualmente como cor, mas continua selecionável).
- Adicionar fallback `color: var(--primary)` para navegadores sem suporte a `background-clip: text`.

## Não muda
- Tokens de cor em `src/styles.css`.
- Qualquer outro componente que use `BrandLogo` (a API `className` continua igual).
- Tamanho/peso da fonte — segue vindo do `className` passado pelo consumidor (ex.: `AppShell`).

## Verificação
- Abrir `/login` e o `AppShell` (header) e confirmar visualmente: "TEA" azul, transição suave no "m", "o" rosa.
- Conferir em viewport 848px (atual) e mobile.
