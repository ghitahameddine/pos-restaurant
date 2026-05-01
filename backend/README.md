# POS2 Backend Spring Boot

Backend REST pour le systeme POS restaurant.

## Prerequis

- Java 21
- Maven 3.9+
- MySQL 8+

> Java est deja disponible sur cette machine. Maven n'est pas encore installe.

## Base de donnees

Creer la base MySQL :

```sql
CREATE DATABASE pos2_restaurant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Configurer les identifiants dans `src/main/resources/application.properties` ou via variables :

```powershell
$env:DB_USERNAME="root"
$env:DB_PASSWORD="votre_mot_de_passe"
```

## Lancer le backend

Depuis le dossier `backend` :

```powershell
mvn spring-boot:run
```

API disponible sur :

```text
http://localhost:8080/api
```

## Endpoints principaux

- `POST /api/auth/register` : inscription client avec OTP simule `1234`
- `POST /api/auth/login` : connexion client ou serveur
- `POST /api/auth/forgot-password` : demande OTP simule
- `POST /api/auth/reset-password` : changer le mot de passe avec OTP
- `POST /api/qr-sessions` : creer un token QR temporaire de 90 minutes
- `GET /api/qr-sessions/{token}` : verifier une session QR
- `GET /api/menu` : liste des produits
- `GET /api/tables` : liste des tables
- `GET /api/slots` : liste des slots cuisine/comptoir
- `GET /api/slots?zone=KITCHEN` : slots internes cuisine
- `GET /api/slots?zone=COUNTER` : slots externes comptoir
- `POST /api/orders` : creer une commande
- `GET /api/orders` : liste des commandes
- `GET /api/orders?status=PENDING_SERVER_VALIDATION` : commandes a valider
- `GET /api/orders?tableNumber=1` : commandes d'une table
- `PATCH /api/orders/{id}/status` : changer le statut d'une commande
- `POST /api/bill-requests` : demander l'addition
- `GET /api/bill-requests?status=PENDING` : demandes d'addition en attente
- `POST /api/bill-requests/{id}/print` : marquer le ticket imprime et la commande payee

## Exemples rapides

Inscription client :

```json
POST /api/auth/register
{
  "phone": "0611111111",
  "otp": "1234",
  "password": "abcd",
  "name": "Client Test"
}
```

Connexion serveur de test :

```json
POST /api/auth/login
{
  "phone": "0600000000",
  "password": "1234"
}
```

Reponse auth :

```json
{
  "token": "jwt...",
  "userId": 1,
  "phone": "0600000000",
  "name": "Serveur POS2",
  "role": "WAITER",
  "points": 0
}
```

Creer un token QR pour la table 1 :

```json
POST /api/qr-sessions
{
  "tableNumber": 1
}
```

Reponse QR :

```json
{
  "token": "token...",
  "tableNumber": 1,
  "status": "ACTIVE",
  "menuPath": "/menu?table=1&token=token..."
}
```

Creer une commande client QR :

```json
{
  "tableNumber": 1,
  "clientPhone": "0600000000",
  "source": "CLIENT_QR",
  "comment": "Sans oignon",
  "items": [
    { "menuItemId": 1, "quantity": 2 }
  ]
}
```

Confirmer une commande par le serveur :

```json
{
  "status": "CONFIRMED",
  "serverComment": "Client confirme a table"
}
```

Demander l'addition :

```json
{
  "orderId": 1
}
```

Imprimer et encaisser :

```json
{
  "paymentMethod": "CASH"
}
```

## Flux respecte

Client ou serveur -> commande `PENDING_SERVER_VALIDATION` -> `CONFIRMED` -> `READY` -> `SERVED` -> addition/paiement -> `PAID`.

Une commande creee directement par le serveur commence en `CONFIRMED`.

La partie cuisine sera branchee apres avec les statuts `CONFIRMED` et `READY`.

## Donnees de test

Au premier demarrage, le backend cree automatiquement :

- 10 tables
- le menu de depart
- 8 slots : 4 cuisine + 4 comptoir
- un serveur :
  - phone : `0600000000`
  - password : `1234`
  - role : `WAITER`

## Temps reel

Deux mecanismes existent :

```text
SSE simple pour React :
- GET /api/realtime

WebSocket STOMP possible :
- Endpoint : /ws
- Topics :
- /topic/orders
- /topic/bill-requests
- /topic/tables
```

Le frontend serveur utilise `GET /api/realtime` pour recevoir les evenements sans polling agressif.

Chaque creation ou changement important publie :

```json
{
  "type": "ORDER_UPDATED",
  "payload": {},
  "createdAt": "..."
}
```

Tables attendues apres redemarrage Spring Boot avec `ddl-auto=update` :

- `users`
- `menu_items`
- `restaurant_tables`
- `customer_orders`
- `order_lines`
- `bill_requests`
- `qr_sessions`
- `slots`
- `kitchen_items`
