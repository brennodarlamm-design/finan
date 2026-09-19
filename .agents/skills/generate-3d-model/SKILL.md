---
name: generate-3d-model
description: >
  Conversão opcional de imagem 2D em modelo GLB para visualização conceitual no FinGo.
  Acione quando houver uma imagem clara de um objeto e o usuário quiser um asset 3D visual.
  Requer confirmação antes de enviar imagens ou credenciais a serviço externo. Nunca use
  o resultado como BIM autoritativo, medição, quantitativo, clash ou engenharia.
risk: external-service
source: adapted
---

# Generate 3D Model — FinGo

## When to use

Leia esta skill quando:

- o usuário fornecer uma imagem 2D e pedir um GLB visual;
- for necessário criar rapidamente um asset conceitual para o viewer;
- o objetivo for protótipo, visualização de produto, AR/VR ou cena demonstrativa;
- não houver IFC/OBJ/GLTF real e um proxy visual for aceitável.

Não use quando existir um arquivo BIM/CAD original. Nesse caso, preserve a geometria original.

Não use para:

- quantitativo de obra;
- orçamento ou medição;
- conferência dimensional;
- clash detection;
- compatibilização de projetos;
- estrutura, elétrica, hidráulica ou segurança;
- emissão de documento técnico.

## External service gate

Esta skill pode depender de provedor externo de geração 3D.

Antes de qualquer envio:

1. confirme com o usuário que a imagem pode sair do ambiente do FinGo;
2. não envie documentos, plantas confidenciais, fotos com dados pessoais ou segredos sem autorização explícita;
3. não leia nem imprima chaves em logs;
4. se a credencial não estiver configurada, pare e informe a dependência;
5. não crie conta, chave, assinatura ou cobrança sem autorização.

## Input contract

Entrada mínima:

```json
{
  "imagePath": "/caminho/absoluto/imagem.png",
  "description": "descrição objetiva do objeto"
}
```

Opcional:

```json
{
  "prompt": "orientação visual adicional"
}
```

A descrição deve identificar claramente o objeto a segmentar. Evite instruções vagas.

## Constraints

1. Imagem recomendada: 1024 px; mínimo prático 512 px.
2. Fundo simples ou transparente é preferível.
3. GLB final: máximo 15 MB para o backend atual do FinGo.
4. Meta: <= 8 MB.
5. Triângulos: <= 150.000; preferir <= 75.000 em mobile.
6. Texturas: máximo 2048x2048.
7. Não aceitar GLB sem magic bytes `glTF`.
8. Não converter um modelo gerado por IA em "IFC oficial".
9. Não gerar GUIDs, propriedades ou disciplinas IFC fictícias.
10. Salvar metadata com `authoritative_bim: false` e a origem do modelo.
11. Se a geometria gerada parecer incompatível com a imagem, rejeitar o asset; não mascarar falha com metadata inventada.

## Workflow

### 1. Validar a imagem localmente

- caminho absoluto;
- arquivo existente;
- PNG/JPG/WEBP;
- resolução >= 512 px;
- objeto principal com contorno legível.

### 2. Obter confirmação para serviço externo

Somente depois da autorização, acione o provedor configurado pela equipe.

### 3. Gerar e baixar o GLB

O executor externo deve retornar pelo menos:

```json
{
  "modelPath": "/caminho/absoluto/model.glb",
  "imagePath": "/caminho/absoluto/imagem.png",
  "description": "objeto"
}
```

Não aceite somente URL temporária como resultado final. O arquivo precisa ser materializado antes da validação.

### 4. Validar deterministicamente

```bash
python .agents/skills/generate-3d-model/scripts/validate_glb.py /caminho/model.glb
```

### 5. Otimizar para web quando necessário

Se exceder orçamento de tamanho/polígonos:

- usar Blender/Python ou glTF Transform;
- preservar escala;
- não aplicar decimação agressiva a pontos de inspeção;
- revalidar o GLB após cada transformação.

### 6. Registrar no FinGo

Salvar como versão visual vinculada à obra, com metadata de procedência e sem marcar como modelo BIM autoritativo.

## Blender/Python recipe

Quando Blender estiver disponível, o agente deve:

1. importar o GLB;
2. medir contagem de triângulos;
3. aplicar decimate apenas se acima do limite;
4. remover objetos vazios e materiais não utilizados;
5. limitar texturas;
6. exportar GLB;
7. validar novamente com `validate_glb.py`.

Nunca usar automação Blender para alterar silenciosamente escala, origem ou orientação sem registrar a transformação.

## Failure rules

- Sem credencial: parar.
- Sem autorização para upload externo: parar e oferecer build123d/local.
- Falha de segmentação: não continuar com objeto errado.
- GLB inválido: rejeitar.
- Tamanho > 15 MB: não enviar ao backend.
- Resultado visual não confiável: marcar como rejeitado, não como BIM.
