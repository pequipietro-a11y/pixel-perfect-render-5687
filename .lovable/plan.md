# Keyframes de efeitos e mídia em 3D

## O que será feito

- Tornar **brilho, desfoque e sombra** propriedades animáveis, com botão de keyframe, valores interpolados e faixas próprias na linha do tempo.
- Adicionar **vídeos como camadas**, com importação pelo painel de ativos e reprodução sincronizada com o tempo do projeto.
- Adicionar controles animáveis de **rotação 3D nos eixos X, Y e Z** para imagens e vídeos.
- Mostrar as transformações e efeitos tanto no palco quanto na exportação de vídeo.

## Comportamento

- Alterar um valor sem animação muda seu valor fixo; depois de criar o primeiro keyframe, novas alterações no tempo atual criam ou atualizam keyframes.
- Imagens e vídeos terão perspectiva 3D no palco; formas, textos e modelos 3D atuais continuam funcionando como antes.
- O vídeo importado seguirá a agulha da linha do tempo e repetirá se for menor que a duração do projeto.

## Detalhes técnicos

- Unificar transformação, efeitos e rotação 3D no modelo de propriedades animáveis.
- Atualizar Inspetor, Linha do Tempo, palco e renderização da exportação para usar os valores amostrados no tempo atual.
- Manter os arquivos de imagem e vídeo locais no navegador.
- Validar a abertura do editor, criação e movimentação de keyframes, rotação 3D e reprodução sincronizada.
