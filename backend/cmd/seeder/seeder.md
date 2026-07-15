# Documentation du Script de Seeding

Ce dossier contient l'outil de synchronisation des métadonnées (Films & Séries) pour `my-tvtime`. 
Ce script permet de mettre à jour les dates de sortie, les titres et les durées (runtime) en base de données via l'API TMDB.

## 1. Compiler pour le VPS
Avant de déployer, compile le binaire pour qu'il soit compatible avec ton environnement Linux (Alpine).

Exécute cette commande depuis la **racine du projet** :

```powershell
# Pour PowerShell (Windows)
$env:CGO_ENABLED="0"; $env:GOOS="linux"; $env:GOARCH="amd64"; go build -o ./cmd/seeder/seed_all ./cmd/seeder/main.go



# 1. Envoyer le binaire sur le VPS
scp seed_all utilisateur@TON_VPS_IP:/tmp/seed_all

# 2. Copier dans le conteneur API
docker cp /tmp/seed_all my-tvtime-api:/tmp/seed_all

# 3. Donner les droits et Exécuter
docker exec -it my-tvtime-api chmod +x /tmp/seed_all
docker exec -it my-tvtime-api /tmp/seed_all

# 4. Nettoyage (Conteneur & VPS)
docker exec -it my-tvtime-api rm /tmp/seed_all
rm /tmp/seed_all


# Compter les films avec runtime à 0
docker exec -it my_tvtime_db psql -U fredray -d mytvtime_db -c "SELECT COUNT(*) FROM movie_metadata WHERE runtime = 0"

# Voir un échantillon des données
docker exec -it my_tvtime_db psql -U fredray -d mytvtime_db -c "SELECT * FROM movie_metadata WHERE release_date IS NOT NULL LIMIT 3"