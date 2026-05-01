export const menuProducts = [
  {
    id: 1,
    name: 'Burger Signature',
    category: 'Burgers',
    price: 45,
    points: 8,
    station: 'Plats',
    description: 'Pain brioche, steak grille, cheddar, salade croquante et sauce maison.',
    details: 'Servi avec frites. Cuisson personnalisable sur demande.',
    prepTime: '12 min',
    badge: 'Populaire',
    accent: '#b89039',
    image:
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 2,
    name: 'Pizza Margherita',
    category: 'Pizzas',
    price: 55,
    points: 10,
    station: 'Plats',
    description: 'Sauce tomate, mozzarella fondante, basilic frais et huile d olive.',
    details: 'Pate fine cuite minute. Taille individuelle.',
    prepTime: '15 min',
    badge: 'Maison',
    accent: '#b89039',
    image:
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 3,
    name: 'Jus Orange Frais',
    category: 'Boissons',
    price: 18,
    points: 3,
    station: 'Boissons',
    description: 'Orange pressee a la commande, sans sucre ajoute.',
    details: 'Disponible bien frais. Format 30 cl.',
    prepTime: '4 min',
    badge: 'Frais',
    accent: '#b89039',
    image:
      'https://plus.unsplash.com/premium_photo-1667543228378-ec4478ab2845?q=80&w=1172&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    id: 4,
    name: 'Tacos Poulet',
    category: 'Tacos',
    price: 49,
    points: 9,
    station: 'Plats',
    description: 'Poulet marine, sauce fromagere, frites et fromage gratine.',
    details: 'Sauce au choix : douce, barbecue ou piquante.',
    prepTime: '13 min',
    badge: 'Best seller',
    accent: '#b89039',
    image:
      'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 5,
    name: 'Salade Cesar',
    category: 'Salades',
    price: 38,
    points: 6,
    station: 'Plats',
    description: 'Poulet grille, laitue, parmesan, croutons et sauce cesar.',
    details: 'Option sans croutons possible.',
    prepTime: '8 min',
    badge: 'Leger',
    accent: '#b89039',
    image:
      'https://plus.unsplash.com/premium_photo-1690561082604-ea47c2a51511?q=80&w=1186&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    id: 6,
    name: 'Tiramisu',
    category: 'Desserts',
    price: 30,
    points: 5,
    station: 'Desserts',
    description: 'Creme mascarpone, cafe doux et cacao.',
    details: 'Dessert froid prepare chaque matin.',
    prepTime: '3 min',
    badge: 'Doux',
    accent: '#b89039',
    image:
      'https://images.unsplash.com/photo-1605621234603-421e591840cd?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
];

export const menuCategories = ['Tous', ...new Set(menuProducts.map((product) => product.category))];

export const rewardLevels = [
  {
    points: 20,
    title: 'Soda gratuit',
    description: 'Une boisson offerte avec la prochaine commande.',
  },
  {
    points: 50,
    title: 'Glace gratuite',
    description: 'Un dessert froid offert pour recompenser la fidelite.',
  },
  {
    points: 100,
    title: 'Menu gratuit',
    description: 'Un menu complet offert apres avoir atteint 100 points.',
  },
];
