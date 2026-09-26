# scripts/prepare_angelim_data.py
import json
import zipfile
import xml.etree.ElementTree as ET
import re
import hashlib
from datetime import datetime

def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings = [''.join(node.itertext()) for node in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si')]
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = sheet.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        res = []
        for r in rows:
            cells = []
            for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                t = c.get('t')
                v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                val = v.text if v is not None else ''
                if t == 's' and val.isdigit() and int(val) < len(strings):
                    val = strings[int(val)]
                cells.append(val or '')
            res.append(cells)
        return res

def clean_date(d):
    if not d or not isinstance(d, str):
        return None
    d = d.strip()
    match = re.match(r'^\d{4}-\d{2}-\d{2}', d)
    if match:
        return match.group(0)
    # Check DD/MM/YYYY
    match_br = re.match(r'^(\d{2})/(\d{2})/(\d{4})', d)
    if match_br:
        return f"{match_br.group(3)}-{match_br.group(2)}-{match_br.group(1)}"
    return None

def clean_num(n):
    if n is None or n == '':
        return 0.0
    try:
        if isinstance(n, (int, float)):
            return float(n)
        val_str = str(n).replace('R$', '').replace(' ', '').strip()
        if ',' in val_str and '.' in val_str:
            val_str = val_str.replace('.', '').replace(',', '.')
        elif ',' in val_str:
            val_str = val_str.replace(',', '.')
        return float(val_str)
    except:
        return 0.0

def norm(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip().lower()

def main():
    print("🚀 Carregando fontes de dados de Angelim Construtora...")

    # 1. JSON Backup (30/08/2026)
    with open('D:/angelim_backup_2026-08-31.json', 'r', encoding='utf-8') as f:
        backup = json.load(f)

    # 2. Obras
    obras_dict = {}
    
    # Sede sempre presente
    obras_dict['escritorio'] = {
        'id': 'escritorio',
        'tenant_id': 'angelim',
        'nome': '🏢 Sede / Escritório Central',
        'cliente': 'Angelim Construtora LTDA',
        'endereco': 'Boa Vista - RR',
        'orcamento_total': 0.0,
        'status': 'em_andamento',
        'data_inicio': '2025-01-01',
        'data_previsao': None
    }

    for c in backup.get('clientes', []):
        cid = c.get('id')
        if not cid:
            continue
        obras_dict[cid] = {
            'id': cid,
            'tenant_id': 'angelim',
            'nome': c.get('nome', '').strip(),
            'cliente': c.get('nome', '').strip(),
            'endereco': f"{c.get('cidade', 'BOA VISTA')} - {c.get('estado', 'RR')}",
            'orcamento_total': clean_num(c.get('valor_financiado') or c.get('orcamento_total')),
            'status': c.get('status', 'em_andamento'),
            'data_inicio': clean_date(c.get('data_inicio')),
            'data_previsao': clean_date(c.get('data_previsao_termino'))
        }

    # Adicionar Dyovanna e Wanderson identificados nas planilhas de Setembro/2026
    if 'dyovanna_pereira' not in obras_dict:
        obras_dict['dyovanna_pereira'] = {
            'id': 'dyovanna_pereira',
            'tenant_id': 'angelim',
            'nome': 'Dyovanna Hevellin Pereira da Silva',
            'cliente': 'Dyovanna Hevellin Pereira da Silva',
            'endereco': 'BOA VISTA - RR',
            'orcamento_total': 0.0,
            'status': 'em_andamento',
            'data_inicio': '2026-08-01',
            'data_previsao': None
        }

    if 'wanderson_silva' not in obras_dict:
        obras_dict['wanderson_silva'] = {
            'id': 'wanderson_silva',
            'tenant_id': 'angelim',
            'nome': 'WANDERSON DOS SANTOS SILVA',
            'cliente': 'WANDERSON DOS SANTOS SILVA',
            'endereco': 'BOA VISTA - RR',
            'orcamento_total': 0.0,
            'status': 'em_andamento',
            'data_inicio': '2026-08-01',
            'data_previsao': None
        }

    # Mapa de nomes para IDs de obras
    obra_name_to_id = {
        'camilly': 'mt83uawgtgljzw8fs',
        'paula vanessa': 'mt83uz3wwco34wetl',
        'sulimara': 'mt83vrqh122s24ilx',
        'dyovanna hevellin pereira da silva': 'dyovanna_pereira',
        'wanderson dos santos silva': 'wanderson_silva',
        'sede / escritório': 'escritorio',
        'sede / escritorio': 'escritorio',
        'sede': 'escritorio',
        'escritorio': 'escritorio'
    }

    # 3. Contas Bancárias
    contas = []
    for c in backup.get('contas', []):
        contas.append({
            'id': c.get('id', 'mt8v5tz4knahsz0l3'),
            'tenant_id': 'angelim',
            'banco_codigo': c.get('banco_codigo', '748'),
            'banco_nome': c.get('banco_nome', 'Sicredi'),
            'agencia': c.get('agencia', '0812'),
            'numero': c.get('numero', '60096-3'),
            'tipo': c.get('tipo', 'corrente'),
            'titular': c.get('titular', 'NAIRA DE AMORIM DA SILVA'),
            'apelido': c.get('apelido', 'sicredi'),
            'saldo_inicial': clean_num(c.get('saldo_inicial', 0)),
            'saldo_atual': clean_num(c.get('saldo_atual', 0))
        })

    # 4. Fornecedores
    forn_dict = {}
    for f in backup.get('fornecedores', []):
        fid = f.get('id')
        if not fid:
            continue
        nome = (f.get('nome_fantasia') or f.get('razao_social') or f.get('nome') or '').strip()
        forn_dict[fid] = {
            'id': fid,
            'tenant_id': 'angelim',
            'nome': nome,
            'razao_social': f.get('razao_social') or nome,
            'cnpj_cpf': f.get('cnpj') or f.get('cnpj_cpf') or '',
            'telefone': f.get('telefone') or '',
            'email': f.get('email') or '',
            'categoria': f.get('categoria') or 'material',
            'chave_pix': f.get('chave_pix') or '',
            'banco_info': f.get('banco_info') or '',
            'endereco': f.get('endereco') or '',
            'municipio': f.get('municipio') or 'BOA VISTA',
            'uf': f.get('uf') or 'RR',
            'ativo': f.get('ativo', True)
        }

    # Mapa de nome normalizado de fornecedor -> id
    forn_name_to_id = {}
    for fid, f in forn_dict.items():
        if f['nome']:
            forn_name_to_id[norm(f['nome'])] = fid
        if f['razao_social']:
            forn_name_to_id[norm(f['razao_social'])] = fid

    # 5. Notas Fiscais
    notas = []
    for n in backup.get('notas', []):
        nid = n.get('id')
        if not nid:
            continue
        obra_id = n.get('obra_id') or 'escritorio'
        if obra_id not in obras_dict:
            obra_id = 'escritorio'
        notas.append({
            'id': nid,
            'tenant_id': 'angelim',
            'numero_nf': n.get('numero_nf') or n.get('numero') or '',
            'serie': n.get('serie') or '1',
            'chave_acesso': n.get('chave_nfe') or n.get('chave_acesso') or None,
            'chave_nfe': n.get('chave_nfe') or None,
            'emitente': n.get('emitente') or n.get('razao_social') or '',
            'cnpj_emitente': n.get('cnpj_emitente') or n.get('cnpj') or '',
            'destinatario': n.get('destinatario') or 'ANGELIM CONSTRUTORA LTDA',
            'data_emissao': clean_date(n.get('data_emissao')),
            'data_vencimento': clean_date(n.get('data_vencimento')),
            'data_pagamento': clean_date(n.get('data_pagamento')),
            'valor_bruto': clean_num(n.get('valor_bruto')),
            'impostos': clean_num(n.get('impostos')),
            'valor_liquido': clean_num(n.get('valor_liquido')),
            'valor_total': clean_num(n.get('valor_total') or n.get('valor_bruto')),
            'tipo': n.get('tipo', 'entrada'),
            'categoria': n.get('categoria', 'material'),
            'obra_id': obra_id,
            'lancamento_id': n.get('lancamento_id'),
            'status': n.get('status', 'paga'),
            'observacoes': n.get('observacoes', ''),
            'pdf_url': n.get('pdf_url'),
            'xml_data': n.get('xml_data')
        })

    # 6. Documentos
    documentos = []
    for d in backup.get('documentos', []):
        did = d.get('id')
        if not did:
            continue
        documentos.append({
            'id': did,
            'tenant_id': 'angelim',
            'tipo': d.get('entidade_tipo') or d.get('tipo') or 'comprovante',
            'referencia_id': d.get('entidade_id') or d.get('referencia_id') or '',
            'titulo': d.get('titulo') or d.get('nome') or d.get('nome_arquivo') or 'Documento',
            'categoria': d.get('categoria') or 'geral',
            'nome_arquivo': d.get('nome_arquivo') or f"{did}.pdf",
            'tipo_arquivo': d.get('tipo_mime') or d.get('tipo_arquivo') or 'application/pdf',
            'tamanho_bytes': int(d.get('tamanho') or d.get('tamanho_bytes') or 0),
            'base64_data': d.get('data_base64') or d.get('base64_data') or None,
            'url': d.get('url') or None
        })

    # 7. Lançamentos
    # Chave para deduplicação: (data, valor_centavos, desc_normalizada[:35])
    lanc_dedup = {}

    def make_key(data, valor, desc):
        cents = round(clean_num(valor) * 100)
        return (str(clean_date(data)), cents, norm(desc)[:35])

    # 7.1 Importar lançamentos do JSON original
    for l in backup.get('lancamentos', []):
        lid = l.get('id')
        if not lid:
            continue
        obra_id = l.get('obra_id') or 'escritorio'
        if obra_id not in obras_dict:
            obra_id = 'escritorio'
        
        forn_id = l.get('fornecedor_id')
        if forn_id and forn_id not in forn_dict:
            forn_id = None

        item = {
            'id': lid,
            'tenant_id': 'angelim',
            'data': clean_date(l.get('data')) or '2026-08-01',
            'data_vencimento': clean_date(l.get('data_vencimento')) or clean_date(l.get('data')) or '2026-08-01',
            'data_pagamento': clean_date(l.get('data_pagamento')),
            'descricao': (l.get('descricao') or 'Lançamento').strip(),
            'categoria': (l.get('categoria') or 'Outros').strip(),
            'fornecedor_beneficiario': (l.get('fornecedor_beneficiario') or '').strip(),
            'fornecedor_id': forn_id,
            'conta_bancaria': (l.get('conta_bancaria') or '').strip(),
            'tipo': 'receita' if l.get('tipo') == 'receita' else 'despesa',
            'valor': clean_num(l.get('valor')),
            'status': l.get('status') or ('pago' if l.get('data_pagamento') else 'pendente'),
            'obra_id': obra_id,
            'nota_fiscal_id': l.get('nota_fiscal_id') or None,
            'codigo_barras': l.get('codigo_barras') or None,
            'chave_nfe': l.get('chave_nfe') or None,
            'observacoes': l.get('observacoes') or '',
            'conciliado': bool(l.get('conciliado')),
            'itens': l.get('itens') if isinstance(l.get('itens'), (list, dict)) else None
        }

        key = make_key(item['data'], item['valor'], item['descricao'])
        lanc_dedup[key] = item

    print(f"✓ {len(lanc_dedup)} lançamentos carregados do JSON original.")

    # 7.2 Importar novos lançamentos do Excel 2026-09-04
    r_all = read_xlsx('D:/Angelim_Todas_as_Obras_Lancamentos_2026-09-04.xlsx')
    # Cabeçalho: Data Emissão, Data Vencimento, Data Pagamento, Obra, Tipo, Categoria, Descrição, Fornecedor, Valor, Status, Conciliado, Conta, Código de Barras, Origem
    new_from_0904 = 0
    for idx, row in enumerate(r_all[1:], 1):
        if len(row) < 9 or not row[0]:
            continue
        data_emiss = clean_date(row[0])
        data_venc = clean_date(row[1]) or data_emiss
        data_pag = clean_date(row[2])
        obra_raw = norm(row[3])
        obra_id = obra_name_to_id.get(obra_raw, 'escritorio')
        
        tipo_raw = norm(row[4])
        tipo = 'receita' if 'receita' in tipo_raw or 'crédito' in tipo_raw else 'despesa'
        categoria = (row[5] or 'Outros').replace('📦', '').replace('🔨', '').replace('🏢', '').replace('?', '').strip()
        descricao = (row[6] or 'Lançamento').strip()
        forn_nome = (row[7] or '').strip()
        valor = clean_num(row[8])
        status = norm(row[9]) or ('pago' if data_pag else 'pendente')
        conciliado = 'sim' in norm(row[10])
        conta = (row[11] or '').strip()
        cod_barras = (row[12] or '').strip() or None

        # Verificar se fornecedor já existe ou criar novo
        forn_id = None
        if forn_nome:
            fnorm = norm(forn_nome)
            if fnorm in forn_name_to_id:
                forn_id = forn_name_to_id[fnorm]
            else:
                # Criar fornecedor dinâmico
                gen_fid = f"forn_dyn_{hashlib.md5(fnorm.encode('utf-8')).hexdigest()[:10]}"
                forn_dict[gen_fid] = {
                    'id': gen_fid,
                    'tenant_id': 'angelim',
                    'nome': forn_nome,
                    'razao_social': forn_nome,
                    'cnpj_cpf': '',
                    'telefone': '',
                    'email': '',
                    'categoria': categoria or 'material',
                    'chave_pix': '',
                    'banco_info': '',
                    'endereco': '',
                    'municipio': 'BOA VISTA',
                    'uf': 'RR',
                    'ativo': True
                }
                forn_name_to_id[fnorm] = gen_fid
                forn_id = gen_fid

        key = make_key(data_emiss, valor, descricao)
        if key not in lanc_dedup:
            gen_lid = f"l_0904_{idx:04d}_{hashlib.md5(f'{data_emiss}_{valor}_{descricao}'.encode('utf-8')).hexdigest()[:6]}"
            lanc_dedup[key] = {
                'id': gen_lid,
                'tenant_id': 'angelim',
                'data': data_emiss,
                'data_vencimento': data_venc,
                'data_pagamento': data_pag,
                'descricao': descricao,
                'categoria': categoria,
                'fornecedor_beneficiario': forn_nome,
                'fornecedor_id': forn_id,
                'conta_bancaria': conta,
                'tipo': tipo,
                'valor': valor,
                'status': status,
                'obra_id': obra_id,
                'nota_fiscal_id': None,
                'codigo_barras': cod_barras,
                'chave_nfe': None,
                'observacoes': 'Importado do relatório geral de 04/09/2026',
                'conciliado': conciliado,
                'itens': None
            }
            new_from_0904 += 1

    print(f"✓ {new_from_0904} novos lançamentos adicionados de 04/09/2026.")

    # 7.3 Importar novos lançamentos do Excel Escritório 2026-09-24
    r_esc = read_xlsx('D:/Angelim_Construtora_Todas_as_Obras_Escritorio_2026-09-24.xlsx')
    # Cabeçalho: Data Emissão, Data Vencimento, Data Pagamento, Categoria, Descrição, Fornecedor, Conta, Valor, Status
    new_from_0924 = 0
    for idx, row in enumerate(r_esc[1:], 1):
        if len(row) < 8 or not row[0]:
            continue
        data_emiss = clean_date(row[0])
        data_venc = clean_date(row[1]) or data_emiss
        data_pag = clean_date(row[2])
        categoria = (row[3] or 'Sede / Escritório').strip()
        descricao = (row[4] or 'Despesa Sede').strip()
        forn_nome = (row[5] or '').strip()
        conta = (row[6] or '').strip()
        valor = clean_num(row[7])
        status = norm(row[8]) if len(row) > 8 else ('pago' if data_pag else 'pendente')

        forn_id = None
        if forn_nome:
            fnorm = norm(forn_nome)
            if fnorm in forn_name_to_id:
                forn_id = forn_name_to_id[fnorm]
            else:
                gen_fid = f"forn_dyn_{hashlib.md5(fnorm.encode('utf-8')).hexdigest()[:10]}"
                forn_dict[gen_fid] = {
                    'id': gen_fid,
                    'tenant_id': 'angelim',
                    'nome': forn_nome,
                    'razao_social': forn_nome,
                    'cnpj_cpf': '',
                    'telefone': '',
                    'email': '',
                    'categoria': categoria or 'sede',
                    'chave_pix': '',
                    'banco_info': '',
                    'endereco': '',
                    'municipio': 'BOA VISTA',
                    'uf': 'RR',
                    'ativo': True
                }
                forn_name_to_id[fnorm] = gen_fid
                forn_id = gen_fid

        key = make_key(data_emiss, valor, descricao)
        if key not in lanc_dedup:
            gen_lid = f"l_0924_{idx:04d}_{hashlib.md5(f'{data_emiss}_{valor}_{descricao}'.encode('utf-8')).hexdigest()[:6]}"
            lanc_dedup[key] = {
                'id': gen_lid,
                'tenant_id': 'angelim',
                'data': data_emiss,
                'data_vencimento': data_venc,
                'data_pagamento': data_pag,
                'descricao': descricao,
                'categoria': categoria,
                'fornecedor_beneficiario': forn_nome,
                'fornecedor_id': forn_id,
                'conta_bancaria': conta,
                'tipo': 'despesa',
                'valor': valor,
                'status': status,
                'obra_id': 'escritorio',
                'nota_fiscal_id': None,
                'codigo_barras': None,
                'chave_nfe': None,
                'observacoes': 'Importado do relatório de despesas da sede de 24/09/2026',
                'conciliado': bool(data_pag),
                'itens': None
            }
            new_from_0924 += 1

    print(f"✓ {new_from_0924} novos lançamentos adicionados de 24/09/2026.")

    # Consolidar resultado
    all_lancamentos = list(lanc_dedup.values())
    all_obras = list(obras_dict.values())
    all_fornecedores = list(forn_dict.values())

    payload = {
        'prepared_at': datetime.now().isoformat(),
        'tenant_id': 'angelim',
        'obras': all_obras,
        'contas': contas,
        'fornecedores': all_fornecedores,
        'notas': notas,
        'documentos': documentos,
        'lancamentos': all_lancamentos
    }

    out_file = 'scratch/angelim_complete_restoration.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print("\n=======================================================")
    print("🎉 DADOS CONSOLIDADOS COM SUCESSO!")
    print(f"  - 🏗️  Obras/Clientes: {len(all_obras)}")
    print(f"  - 🏦 Contas Bancárias: {len(contas)}")
    print(f"  - 🤝 Fornecedores: {len(all_fornecedores)}")
    print(f"  - 🧾 Notas Fiscais: {len(notas)}")
    print(f"  - 📎 Documentos/Anexos: {len(documentos)}")
    print(f"  - 💰 Lançamentos Totais: {len(all_lancamentos)}")
    print(f"  Salvo em: {out_file}")
    print("=======================================================\n")

if __name__ == '__main__':
    main()
