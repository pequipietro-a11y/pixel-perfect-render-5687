# Seleção livre e remoção de fundo

## O que será alterado
- Trocar a seleção retangular por um laço livre: desenhar o contorno diretamente sobre a imagem.
- Ao clicar em **Separar**, criar uma nova camada contendo somente a área desenhada, com transparência fora do contorno.
- Adicionar **Chroma key** com seletor de cor, conta-gotas na prévia e ajuste de tolerância.
- Preservar transparência real de arquivos PNG; quando um PNG tiver fundo opaco, remover automaticamente apenas o fundo conectado às bordas.

## Detalhes técnicos
- Processar os pixels no navegador e gerar novos PNGs transparentes, sem enviar a imagem para serviços externos.
- Manter os recortes e a remoção de fundo compatíveis com o palco e a exportação de vídeo.
- Testar a seleção livre, o chroma key e a importação de PNG no editor.
