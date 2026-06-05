# Site de Votação

Aplicação React + Vite com Netlify Functions e Google Sheets como fonte de verdade.

O site é público e usa anti-spam leve para permitir apenas um voto por browser/dispositivo aproximado. Não há login nem link por pessoa.

## Como funciona

- O frontend envia metadados básicos do navegador para calcular um fingerprint leve
- A função `POST /vote` calcula `ip_hash` e `household_hash`
- Se esse fingerprint já tiver votado, o voto é rejeitado
- Se não tiver votado, o voto é gravado na sheet `Votes`
- Os totais são lidos diretamente da sheet

## Variáveis de ambiente

Cria um ficheiro `.env` com base em `.env.example`.

Required:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `VOTE_HASH_SALT`

Optional:

- `GOOGLE_VOTES_SHEET_NAME` default `Votes`

## Estrutura da sheet

`Votes`:

- `vote_id`
- `item_id`
- `ip_hash`
- `household_hash`
- `created_at`
- `user_agent`
- `timezone`
- `screen`
- `locale`

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
