# MELCloud

## Présentation

Cette intégration connecte Gladys Assistant à **MELCloud**, le service cloud de
Mitsubishi Electric, pour piloter vos climatiseurs depuis Gladys.

Une fois configurée, tous les appareils de votre compte MELCloud apparaissent
dans l'écran **Découverte** de Gladys. Les unités air-air exposent trois
fonctionnalités pilotables :

- **Marche/Arrêt** — allumer ou éteindre l'unité ;
- **Mode** — chauffage, déshumidification, climatisation, ventilation ou auto ;
- **Température** — la température de consigne, dans les bornes min/max de l'unité.

L'état des appareils est rafraîchi toutes les 10 secondes : un changement fait
depuis la télécommande Mitsubishi ou l'application MELCloud apparaît dans
Gladys peu après. Les unités air-eau et de ventilation (Lossnay) sont listées
mais n'exposent pas encore de fonctionnalité.

## Prérequis

- Un **compte MELCloud** ([app.melcloud.com](https://app.melcloud.com)) avec
  vos climatiseurs déjà enregistrés dedans : chaque unité doit être équipée
  d'une interface Wi-Fi Mitsubishi (par ex. MAC-567IF-E) appairée avec
  l'application MELCloud.
- Les unités doivent être joignables depuis MELCloud : cette intégration
  dialogue avec le cloud Mitsubishi, votre instance Gladys doit donc avoir
  accès à Internet.

## Configuration

1. Installez l'intégration depuis le store Gladys.
2. Ouvrez son écran de **Configuration** et renseignez :
   - **E-mail MELCloud** — l'adresse e-mail de votre compte MELCloud ;
   - **Mot de passe MELCloud** — le mot de passe de ce compte (stocké comme
     secret, jamais réaffiché).
3. Enregistrez. L'intégration se connecte à MELCloud et charge vos appareils.
4. Ouvrez l'écran **Découverte** : vos unités y sont listées. Ajoutez celles
   que vous voulez, puis placez-les dans vos pièces et tableaux de bord comme
   n'importe quel appareil Gladys.

Pour utiliser un autre compte MELCloud plus tard, mettez simplement à jour
l'e-mail et le mot de passe dans l'écran de Configuration : l'intégration se
reconnecte et rafraîchit la liste des appareils automatiquement.

## Dépannage

- **« MELCloud is not configured » pendant la découverte** — l'e-mail ou le mot
  de passe manque : renseignez les deux champs dans l'écran de Configuration et
  enregistrez.
- **La connexion échoue** — vérifiez vos identifiants en vous connectant sur
  [app.melcloud.com](https://app.melcloud.com). Si MELCloud vous demande
  d'accepter de nouvelles conditions d'utilisation, acceptez-les dans
  l'application puis réessayez.
- **Une unité n'apparaît pas dans la Découverte** — vérifiez qu'elle est
  visible dans l'application MELCloud avec le même compte, puis relancez la
  découverte.
- **Les commandes semblent ignorées** — MELCloud peut mettre quelques secondes
  à transmettre une commande à l'unité ; l'état dans Gladys reflète l'état du
  cloud et se met à jour au rafraîchissement suivant (10 secondes). Vérifiez
  aussi que l'unité est en ligne dans l'application MELCloud (adaptateur Wi-Fi
  connecté).
- **Les états ne se mettent plus à jour** — la session MELCloud a pu expirer ;
  l'intégration se reconnecte automatiquement. Si le problème persiste,
  consultez les journaux de l'intégration depuis sa page de configuration dans
  Gladys.
