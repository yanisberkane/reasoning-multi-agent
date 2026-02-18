# Agentique AI - Système Multi-Agent de Vente

Système multi-agent en TypeScript avec raisonnement (Chain of Thought), routage intelligent et mémoire utilisateur progressive pour l'assistance commerciale.

> **[Documentation technique detaillée (TECHNICAL.md)](TECHNICAL.md)** -- diagrammes d'architecture, flux de données, schémas de données, choix techniques.

## Architecture

```
Utilisateur ──> Chat UI (Next.js)
                  │
                  ▼
            API Route /api/chat
                  │
          ┌───────┼───────┐
          ▼       ▼       ▼
    Memory     Thinker   Memory
    Retrieve   Agent     Extract
    (pré)     (CoT)     (post)
               │
        ┌──────┼──────┐
        ▼             ▼
   Lead Agent    Writer Agent
   (RAG/Vector)  (Email perso)
        │             │
        ▼             ▼
   MongoDB Atlas  User Memory
   (leads)       (preferences)
```

### Composants

| Composant | Rôle |
|-----------|------|
| **Agent Thinker** | Orchestrateur central. Raisonne en Chain of Thought, identifie les informations nécessaires, route vers les agents spécialisés, assemble la réponse finale. |
| **Agent Lead** | Recherche et récupère les informations des leads via recherche vectorielle (MongoDB Atlas Vector Search) ou recherche textuelle. |
| **Agent Writer** | Génère des emails et relances personnalisés en s'appuyant sur le contexte du lead ET les préférences de l'utilisateur issues de la mémoire. |
| **Memory Manager** | Extrait, stocke et récupère les observations sur le style et les préférences de l'utilisateur. Permet une personnalisation progressive. |

## Stack Technique

- **Runtime** : Next.js 15 (App Router) + TypeScript
- **LLM** : Anthropic Claude (via `@ai-sdk/anthropic`)
- **Framework Agent** : Vercel AI SDK v6 (`ai` + `@ai-sdk/react`)
- **Embeddings** : OpenAI `text-embedding-3-small` (via `@ai-sdk/openai`)
- **Base de données** : MongoDB Atlas avec Vector Search
- **UI** : Tailwind CSS v4 + shadcn/ui
- **Validation** : Zod v4

## Prérequis

- **Node.js** >= 18
- **npm** >= 9
- Un compte **MongoDB Atlas** (free tier M0 suffit)
- Une clé API **Anthropic** (Claude)
- Une clé API **OpenAI** (uniquement pour les embeddings)

## Installation

### 1. Cloner le repository

```bash
git clone https://github.com/yanisberkane/reasoning-multi-agent.git
cd reasoning-multi-agent
npm install
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Remplir le fichier `.env` :

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
MONGODB_URI=mongodb+srv://...
```

### 3. Configurer MongoDB Atlas

1. Créer un cluster sur [MongoDB Atlas](https://cloud.mongodb.com/) (free tier M0)
2. Créer une base de données nommée `agentique`
3. Créer les index Vector Search via l'onglet **Atlas Search** du cluster :

**Index 1 - Leads** :
- Nom : `leads_vector_index`
- Collection : `leads`
- Définition JSON :

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

**Index 2 - Memories** :
- Nom : `memories_vector_index`
- Collection : `memories`
- Définition JSON :

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    }
  ]
}
```

### 4. Seeder la base de données

```bash
npm run seed
```

Cette commande :
- Charge 30 leads fictifs réalistes depuis `data/leads.json`
- Génère les embeddings vectoriels pour chaque lead
- Insère le tout dans MongoDB Atlas

### 5. Lancer l'application

```bash
npm run dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

## Fonctionnement

### Chain of Thought (Agent Thinker)

L'agent Thinker est le point d'entrée de chaque requête. Il utilise un outil `think` pour expliciter son raisonnement avant d'agir :

1. **Analyse** la demande utilisateur
2. **Identifie** les informations manquantes
3. **Planifie** les actions (quels agents appeler)
4. **Exécute** en chaînant les appels d'outils
5. **Synthétise** la réponse finale

Le raisonnement est visible dans l'interface via un panneau de tracing collapsible.

### Mémoire Utilisateur Progressive

Le système apprend les préférences de l'utilisateur au fil des interactions :

| Interaction | Comportement |
|-------------|-------------|
| 1-2 | Réponses génériques, premières observations captées (ton, niveau de détail) |
| 3-4 | Adaptation visible du style et de la structure des emails |
| 5+ | Messages très proches du style naturel de l'utilisateur |

**Ce qui est mémorisé :**
- Style de communication (ton, formulations, niveau de formalité)
- Formats préférés (structure des emails, longueur, accroches)
- Corrections (si l'utilisateur reformule, le système en tient compte)
- Préférences (informations toujours incluses, sujets mis en avant)
- Comportements (patterns de décision, priorités)

**Fonctionnement technique :**
- Après chaque interaction, un appel LLM dédié extrait les observations
- Chaque observation est vectorisée et stockée dans MongoDB
- Avant chaque nouvelle interaction, les mémoires pertinentes sont récupérées par recherche vectorielle
- Un profil utilisateur agrégé est injecté dans les prompts des agents

### RAG (Agent Lead)

- 30 leads fictifs réalistes dans divers secteurs (SaaS, fintech, e-commerce, etc.)
- Recherche vectorielle via MongoDB Atlas Vector Search
- Fallback sur recherche textuelle si la recherche vectorielle échoue

## Exemples d'utilisation

```
> Montre-moi les leads en phase de négociation

> Rédige un email de premier contact pour Marc Dubois de FinancePlus

> Écris une relance pour Claire Lefebvre, on avait discuté de l'intégration Odoo

> Quels sont les leads dans la fintech avec un deal supérieur à 100K€ ?

> Reformule l'email précédent avec un ton plus décontracté
  (→ le système mémorise cette préférence de ton pour les futures interactions)
```

## Structure du Projet

```
src/
├── app/
│   ├── layout.tsx              # Layout avec dark mode
│   ├── page.tsx                # Page principale
│   └── api/chat/route.ts       # API endpoint streaming
├── agents/
│   ├── thinker.ts              # Agent Thinker (CoT + routage)
│   ├── lead-agent.ts           # Agent Lead (RAG)
│   └── writer-agent.ts         # Agent Writer (emails)
├── memory/
│   ├── manager.ts              # Extraction & retrieval mémoire
│   └── types.ts                # Types mémoire
├── db/
│   ├── client.ts               # Connexion MongoDB singleton
│   ├── types.ts                # Types Lead, MemoryEntry, etc.
│   ├── leads.ts                # Requêtes leads
│   ├── memory.ts               # CRUD mémoire
│   └── seed.ts                 # Script de seeding
├── lib/
│   ├── embeddings.ts           # Génération embeddings
│   └── tracing.ts              # Logger CoT
└── components/
    ├── chat.tsx                # Interface chat principale
    ├── message.tsx             # Rendu des messages
    └── thinking-panel.tsx      # Panneau de tracing CoT
```
