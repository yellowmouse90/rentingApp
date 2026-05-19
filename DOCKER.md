# Docker Setup Guide

Questa guida ti aiuterà a configurare e eseguire l'applicazione con Docker.

## File Created

- **Dockerfile** - Configurazione multi-stage per build e produzione
- **docker-compose.yml** - Orchestrazione dei container
- **.dockerignore** - File da escludere dalla build Docker
- **.env.docker** - Variabili d'ambiente di esempio

## Prerequisiti

- Docker Desktop installato ([Download](https://www.docker.com/products/docker-desktop))
- Docker Compose (incluso in Docker Desktop)

## Quick Start

### 1. Build dell'immagine Docker

```bash
docker build -t renting-app:latest .
```

### 2. Esecuzione con Docker Compose

```bash
# Avviare l'applicazione
docker-compose up -d

# Visualizzare i log
docker-compose logs -f

# Fermare l'applicazione
docker-compose down
```

### 3. Esecuzione diretta con Docker

```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  renting-app:latest
```

## Configurazione delle Variabili d'Ambiente

1. Copia `.env.docker` a `.env.local`:
   ```bash
   cp .env.docker .env.local
   ```

2. Modifica `.env.local` con i tuoi valori reali:
   - Supabase URL e chiave
   - Chiavi Stripe
   - Secret NextAuth
   - Credenziali Google OAuth

3. Aggiorna `docker-compose.yml` per includere le variabili:
   ```yaml
   environment:
     - NEXT_PUBLIC_SUPABASE_URL=your_value
     # ... altre variabili
   ```

## Comandi Utili

```bash
# Build dell'immagine
docker build -t renting-app:latest .

# Esecuzione con compose
docker-compose up -d
docker-compose up --build          # Build e avviamento
docker-compose down                # Arresto
docker-compose logs -f app         # Log in tempo reale
docker-compose restart             # Riavvio

# Esecuzione interattiva
docker-compose exec app sh

# Pulizia
docker-compose down -v             # Rimuove i volumi
docker image prune                 # Rimuove immagini non usate
docker system prune                # Pulizia completa
```

## Troubleshooting

### La porta 3000 è già in uso
```bash
# Usa una porta diversa
docker run -p 8000:3000 renting-app:latest
```

### Errori di build
```bash
# Rebuild senza cache
docker build --no-cache -t renting-app:latest .
```

### Accesso al container
```bash
docker-compose exec app sh
```

### Visualizzare tutte le immagini
```bash
docker images
```

### Rimuovere un'immagine
```bash
docker rmi renting-app:latest
```

## Note Importanti

- Il Dockerfile utilizza Node.js 20 Alpine (leggero e sicuro)
- Build multi-stage per ridurre la dimensione dell'immagine finale
- Usa `pnpm` per le dipendenze (come nel progetto)
- Le dipendenze di produzione vengono installate, non di sviluppo

## Prossimi Passi

1. Configura le variabili d'ambiente
2. Testa localmente: `docker-compose up`
3. Verifica l'accesso: `http://localhost:3000`
4. Se necessario, aggiungi servizi a `docker-compose.yml`
