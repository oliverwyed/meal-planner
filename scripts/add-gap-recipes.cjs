const fs = require('fs');
const recipes = require('../src/data/recipes.json');

const newRecipes = [

  // ── DESSERTS (11) ──────────────────────────────────────────────────────────

  {
    name: 'Dark Chocolate Mousse', course: 'dessert',
    time: '20 min', minutes: 20, protein: 'veggie', cuisine: 'french', carb: 'none', serves: 4,
    description: 'Intensely dark, impossibly light — proper French chocolate mousse made with just chocolate, eggs, butter and a pinch of salt. The contrast between the bitter depth and the airy texture is the whole point.',
    kidNote: 'Use 50% chocolate instead of 70% for a milder version, and let them help with the folding',
    tip: 'Fold the egg whites in three additions — the first loosens the chocolate, the second and third keep the air in. Slow, gentle strokes only.',
    ingredients: [
      '200g dark chocolate (70%), broken up', '4 eggs, separated', '30g butter',
      '2 tbsp caster sugar', 'pinch of salt', 'pinch of sea salt flakes, to serve'
    ],
    steps: [
      'Melt the chocolate and butter together in a heatproof bowl over simmering water, or in short bursts in the microwave. Stir until smooth, then leave to cool for 5 minutes.',
      'Beat the egg yolks into the cooled chocolate one at a time until glossy and combined.',
      'Whisk the egg whites with a pinch of salt until soft peaks form, then add the sugar and whisk to stiff, glossy peaks.',
      'Fold a large spoonful of egg white into the chocolate mixture to loosen it, then gently fold in the rest in two additions. Stop as soon as no streaks of white remain.',
      'Spoon into glasses or ramekins and refrigerate for at least 2 hours. Serve with a pinch of sea salt flakes on top.'
    ],
    nutrition: { calories: 380, protein: 9, carbs: 28, fat: 26 },
    photo: '/recipe-images/ai-dark-chocolate-mousse.jpg'
  },

  {
    name: 'Classic Lemon Tart', course: 'dessert',
    time: '55 min', minutes: 55, protein: 'eggs', cuisine: 'french', carb: 'none', serves: 8,
    seasons: ['spring', 'summer'],
    description: 'Sharp, silky lemon curd in a crisp, buttery pastry case — the kind of tart that makes people stop talking. The filling should just tremble in the centre when it comes out of the oven.',
    kidNote: 'Serve with a dusting of icing sugar and a spoonful of crème fraîche to soften the sharpness for younger palates',
    tip: 'Blind bake the pastry until genuinely golden — a pale case will go soggy. The filling goes in hot and bakes briefly, so the pastry needs to be fully cooked before the custard is added.',
    ingredients: [
      '320g shortcrust pastry (shop-bought or homemade)', '4 eggs plus 2 yolks',
      '175g caster sugar', 'zest and juice of 3 large lemons', '150ml double cream',
      'icing sugar, to dust'
    ],
    steps: [
      'Roll out the pastry and line a 23cm loose-bottomed tart tin. Chill for 30 minutes. Heat oven to 190°C/170°C fan. Blind bake with baking paper and beans for 15 minutes, remove beans and bake for 10 more minutes until golden.',
      'Reduce oven to 150°C/130°C fan. Whisk eggs, yolks and sugar together until combined. Stir in lemon zest, juice and cream.',
      'Pour the filling through a sieve into the hot pastry case — doing this in the oven on a pulled-out rack prevents spills.',
      'Bake for 25–30 minutes until the filling is just set with a slight wobble in the centre. It will firm up as it cools.',
      'Cool completely before removing from the tin. Dust generously with icing sugar and serve in thin slices.'
    ],
    nutrition: { calories: 340, protein: 6, carbs: 38, fat: 18 },
    photo: '/recipe-images/ai-classic-lemon-tart.jpg'
  },

  {
    name: 'Apple Tarte Tatin', course: 'dessert',
    time: '45 min', minutes: 45, protein: 'veggie', cuisine: 'french', carb: 'none', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'Caramelised apples under a crisp pastry lid, inverted at the table to reveal glossy, amber fruit. Accidental genius from the Tatin sisters — a classic for a reason.',
    kidNote: 'Universally loved by children — serve warm with a scoop of vanilla ice cream',
    tip: 'Don\'t stir the caramel once the sugar has dissolved — swirl the pan instead. Stirring causes crystallisation and you\'ll end up with a grainy mess.',
    ingredients: [
      '6 Cox or Braeburn apples, peeled, cored and halved',
      '150g caster sugar', '75g butter', '1 tsp vanilla extract',
      '320g all-butter puff pastry', 'crème fraîche or vanilla ice cream, to serve'
    ],
    steps: [
      'Heat oven to 200°C/180°C fan. In a 24cm ovenproof frying pan, melt the butter over medium heat. Add the sugar in an even layer and cook without stirring until it turns a deep amber caramel, about 8–10 minutes. Swirl the pan rather than stirring.',
      'Remove from heat. Add vanilla and arrange apple halves tightly in the caramel, cut-side up — they\'ll shrink during cooking so pack them in.',
      'Cook on the hob for 5 minutes to start softening, then remove from heat.',
      'Roll the pastry into a circle slightly larger than your pan. Lay over the apples and tuck the edges down around them. Bake for 25–30 minutes until the pastry is deeply golden.',
      'Leave to cool for 5 minutes, then place a plate larger than the pan on top and invert in one confident move. Serve warm with crème fraîche or ice cream.'
    ],
    nutrition: { calories: 420, protein: 4, carbs: 58, fat: 19 },
    photo: '/recipe-images/ai-apple-tarte-tatin.jpg'
  },

  {
    name: 'Treacle Tart', course: 'dessert',
    time: '50 min', minutes: 50, protein: 'veggie', cuisine: 'british', carb: 'none', serves: 8,
    seasons: ['autumn', 'winter'],
    description: 'Golden syrup, breadcrumbs and lemon in a short pastry case — the great British pudding. Sticky, intensely sweet and warming, with just enough lemon sharpness to stop it being cloying.',
    kidNote: 'A genuine crowd-pleaser for children — the sweetness is familiar and comforting',
    tip: 'Fresh white breadcrumbs (not dried) are essential — they soak up the syrup and give the filling its distinctive soft, almost fudgy texture.',
    ingredients: [
      '320g shortcrust pastry', '350g golden syrup', '75g fresh white breadcrumbs',
      'zest and juice of 1 lemon', '2 tbsp double cream',
      'clotted cream or vanilla ice cream, to serve'
    ],
    steps: [
      'Heat oven to 190°C/170°C fan. Roll out pastry and line a 23cm loose-bottomed tart tin. Chill for 20 minutes. Blind bake for 15 minutes with baking paper and beans, then 5 more minutes without.',
      'Warm the golden syrup gently in a pan until runny. Stir in the breadcrumbs, lemon zest, juice and cream until combined.',
      'Pour the filling into the pastry case and spread evenly.',
      'Bake for 25–30 minutes until the filling is set and lightly golden on top — it will still have a slight wobble.',
      'Leave to cool for at least 15 minutes before slicing — the filling is extremely hot straight from the oven. Serve warm with clotted cream.'
    ],
    nutrition: { calories: 390, protein: 4, carbs: 64, fat: 13 },
    photo: '/recipe-images/ai-treacle-tart.jpg'
  },

  {
    name: 'Chocolate Fudge Brownies', course: 'dessert',
    time: '35 min', minutes: 35, protein: 'eggs', cuisine: 'american', carb: 'none', serves: 16,
    description: 'Dense, fudgy, crackling-topped brownies with an intensely chocolatey centre. The kind that leave a dark smear on the plate and make people ask for the recipe.',
    kidNote: 'A guaranteed hit — let children press in extra chocolate chips before baking',
    tip: 'Underbake slightly — the brownies continue cooking in the tin after leaving the oven. A skewer should come out with moist crumbs, not clean.',
    ingredients: [
      '200g dark chocolate, broken up', '175g butter', '300g caster sugar',
      '3 eggs', '1 tsp vanilla extract', '100g plain flour',
      '30g cocoa powder', '½ tsp salt', '100g chocolate chips (optional)'
    ],
    steps: [
      'Heat oven to 180°C/160°C fan. Grease and line a 20×20cm baking tin. Melt chocolate and butter together, stir until smooth, and leave to cool slightly.',
      'Whisk sugar and eggs together until pale and thick, about 3 minutes. Stir in the vanilla and the cooled chocolate mixture.',
      'Fold in flour, cocoa and salt until just combined — don\'t overmix. Fold in chocolate chips if using.',
      'Pour into the prepared tin and bake for 22–25 minutes. The top should be set and crackled but the centre should still have a fudgy wobble.',
      'Cool completely in the tin before cutting into squares — brownies cut badly when warm and collapse.'
    ],
    nutrition: { calories: 280, protein: 4, carbs: 34, fat: 15 },
    photo: '/recipe-images/ai-chocolate-fudge-brownies.jpg'
  },

  {
    name: 'Baked New York Cheesecake', course: 'dessert',
    time: '75 min', minutes: 75, protein: 'eggs', cuisine: 'american', carb: 'none', serves: 10,
    description: 'Dense, creamy, ivory-coloured cheesecake on a digestive biscuit base with a barely-there wobble and no cracks. The definitive version of the American original.',
    kidNote: 'Serve with strawberry compote or fresh berries for the fruit element children often want alongside the richness',
    tip: 'Bake in a water bath and turn the oven off rather than removing the cheesecake — the gradual cooling prevents cracking. Patience is the only technique.',
    ingredients: [
      '200g digestive biscuits, crushed', '80g butter, melted',
      '900g full-fat cream cheese, at room temperature', '250g caster sugar',
      '3 tbsp plain flour', '1 tsp vanilla extract', '3 eggs plus 1 yolk',
      '150ml soured cream', 'zest of 1 lemon'
    ],
    steps: [
      'Heat oven to 180°C/160°C fan. Mix crushed biscuits with melted butter and press firmly into the base of a lined 23cm springform tin. Bake for 10 minutes. Reduce oven to 160°C/140°C fan.',
      'Beat cream cheese until smooth. Add sugar and flour, beat until combined. Add vanilla, lemon zest, eggs and yolk one at a time, beating slowly. Stir in soured cream.',
      'Pour onto the biscuit base. Place the tin in a roasting tin and pour in hot water to come halfway up the sides.',
      'Bake for 50–55 minutes until the edges are set but the centre still has a distinct wobble. Turn off the oven and leave the cheesecake inside for 1 hour with the door ajar.',
      'Remove, cool to room temperature, then refrigerate for at least 4 hours or overnight. Run a knife around the edge before releasing the tin.'
    ],
    nutrition: { calories: 510, protein: 9, carbs: 38, fat: 36 },
    photo: '/recipe-images/ai-baked-new-york-cheesecake.jpg'
  },

  {
    name: 'Pavlova with Cream & Seasonal Berries', course: 'dessert',
    time: '90 min', minutes: 90, protein: 'eggs', cuisine: 'british', carb: 'none', serves: 8,
    seasons: ['spring', 'summer'],
    description: 'A cloud of meringue — crisp and shattering on the outside, marshmallowy within — piled with softly whipped cream and vivid summer berries. Spectacular to look at and forgiving to make.',
    kidNote: 'Children love helping decorate the pavlova with berries — make it part of the occasion',
    tip: 'Cornflour and vinegar are not optional — they create the marshmallowy centre by preventing the meringue from drying out completely during baking.',
    ingredients: [
      '4 egg whites', '200g caster sugar', '1 tsp cornflour',
      '1 tsp white wine vinegar', '1 tsp vanilla extract',
      '300ml double cream', '500g mixed berries (strawberries, raspberries, blueberries)',
      '2 tbsp icing sugar'
    ],
    steps: [
      'Heat oven to 130°C/110°C fan. Line a baking sheet with baking paper and draw a 22cm circle as a guide. Whisk egg whites to stiff peaks, then add sugar 1 tbsp at a time, whisking constantly until the meringue is thick and glossy.',
      'Fold in cornflour, vinegar and vanilla. Pile onto the paper circle and spread into a round with a slight indent in the centre for the cream.',
      'Bake for 75 minutes, then turn off the oven and leave inside to cool completely — at least 1 hour. The outside will crack slightly: this is correct.',
      'Whip the cream with 1 tbsp icing sugar to soft peaks. Pile into the centre of the cooled meringue.',
      'Toss the berries with remaining icing sugar and heap over the cream just before serving. Carry to the table as-is — the rustic collapse is part of the charm.'
    ],
    nutrition: { calories: 310, protein: 4, carbs: 44, fat: 14 },
    photo: '/recipe-images/ai-pavlova-with-cream-seasonal-berries.jpg'
  },

  {
    name: 'Baked Rice Pudding', course: 'dessert',
    time: '90 min', minutes: 90, protein: 'eggs', cuisine: 'british', carb: 'rice', serves: 4,
    seasons: ['autumn', 'winter'],
    description: 'Slow-baked, skin-topped, utterly comforting rice pudding — one of Britain\'s finest puddings. The long bake in the oven produces a depth of flavour you can\'t get any other way.',
    kidNote: 'A gentle, warming pudding that almost all children love — serve with a spoonful of strawberry jam stirred through',
    tip: 'The golden skin is the prize — resist stirring it during cooking. Some bakers even argue over who gets the skin.',
    ingredients: [
      '100g pudding rice', '1 litre whole milk', '50ml double cream',
      '50g caster sugar', '1 tsp vanilla extract', '½ tsp freshly grated nutmeg',
      '25g butter', 'raspberry or strawberry jam, to serve'
    ],
    steps: [
      'Heat oven to 150°C/130°C fan. Butter a large, shallow ovenproof dish generously.',
      'Combine the pudding rice, milk, cream, sugar and vanilla in the dish. Stir well. Dot the surface with small pieces of butter and grate nutmeg generously over the top.',
      'Bake for 30 minutes, then stir gently and return to the oven.',
      'Bake for a further 60 minutes without stirring until the top is golden and the rice has absorbed most of the milk. The pudding should still be slightly loose — it thickens as it cools.',
      'Serve warm from the dish with a generous spoonful of jam on each portion.'
    ],
    nutrition: { calories: 320, protein: 8, carbs: 48, fat: 12 },
    photo: '/recipe-images/ai-baked-rice-pudding.jpg'
  },

  {
    name: 'Churros with Chocolate Dipping Sauce', course: 'dessert',
    time: '25 min', minutes: 25, protein: 'eggs', cuisine: 'mexican', carb: 'bread', serves: 4,
    description: 'Crispy, ridged doughnuts rolled in cinnamon sugar and served with a thick, dark chocolate sauce for dipping. The best dessert for sharing — everyone reaches in at once.',
    kidNote: 'A guaranteed hit — let children roll the hot churros in the cinnamon sugar themselves',
    tip: 'Pipe the churros directly into the oil using a piping bag with a large star nozzle — scissors snip them to length. The oil must be at 180°C or they\'ll absorb too much fat.',
    ingredients: [
      '250ml water', '1 tbsp caster sugar', '½ tsp salt', '1 tbsp vegetable oil',
      '150g plain flour', '2 eggs', '1 litre vegetable oil, for deep frying',
      '4 tbsp caster sugar mixed with 1 tsp cinnamon, for rolling',
      '150g dark chocolate', '150ml double cream', '1 tbsp golden syrup'
    ],
    steps: [
      'Make the chocolate sauce: heat cream until just simmering, pour over broken chocolate and golden syrup. Leave for 2 minutes then stir until smooth. Keep warm.',
      'Bring water, sugar, salt and oil to a boil. Add flour all at once and beat vigorously until the mixture pulls away from the sides. Cool for 5 minutes then beat in the eggs.',
      'Heat oil to 180°C in a deep pan. Transfer dough to a piping bag fitted with a large star nozzle.',
      'Pipe 10cm lengths directly into the oil, snipping with scissors. Fry in batches for 3–4 minutes until deep golden. Drain on kitchen paper.',
      'Roll immediately in cinnamon sugar and serve with the warm chocolate sauce for dipping.'
    ],
    nutrition: { calories: 520, protein: 8, carbs: 58, fat: 28 },
    photo: '/recipe-images/ai-churros-with-chocolate-dipping-sauce.jpg'
  },

  {
    name: 'Mango Sticky Rice', course: 'dessert',
    time: '30 min', minutes: 30, protein: 'veggie', cuisine: 'asian', carb: 'rice', serves: 4,
    seasons: ['spring', 'summer'],
    description: 'Thailand\'s most iconic street dessert — glutinous rice soaked in sweet coconut cream alongside ripe, fragrant mango. Simple, light and completely transporting.',
    kidNote: 'Children adore this — the sweet coconut rice and ripe mango is an irresistible combination',
    tip: 'Use the ripest mangoes you can find — the dish entirely depends on their fragrance and sweetness. Ataulfo or Alphonso varieties are ideal.',
    ingredients: [
      '300g Thai glutinous (sticky) rice, soaked in cold water for 1 hour',
      '400ml tin coconut milk', '4 tbsp caster sugar', '½ tsp salt',
      '2 ripe mangoes, peeled and sliced', '1 tbsp sesame seeds, toasted'
    ],
    steps: [
      'Drain the soaked rice. Steam over simmering water for 25 minutes until tender and translucent.',
      'Meanwhile, warm the coconut milk with sugar and salt until the sugar dissolves. Do not boil.',
      'When the rice is cooked, transfer to a bowl and stir in three-quarters of the warm coconut mixture. Cover and leave to absorb for 15 minutes — the rice will soak up the coconut and become sticky and glossy.',
      'Reserve the remaining coconut mixture as a sauce to pour over at the table.',
      'Serve the sticky rice alongside sliced mango, drizzle with the reserved coconut sauce and scatter with toasted sesame seeds.'
    ],
    nutrition: { calories: 420, protein: 6, carbs: 76, fat: 12 },
    photo: '/recipe-images/ai-mango-sticky-rice.jpg'
  },

  {
    name: 'Poached Pears in Spiced Red Wine', course: 'dessert',
    time: '40 min', minutes: 40, protein: 'veggie', cuisine: 'french', carb: 'none', serves: 4,
    seasons: ['autumn', 'winter'],
    description: 'Whole pears, slowly poached until garnet-red and tender in a cinnamon, star anise and red wine syrup. Elegant, make-ahead, and more impressive than the effort suggests.',
    kidNote: 'Poach in grape juice instead of wine for a fully child-friendly version — the pears turn a beautiful purple-red either way',
    tip: 'Choose firm pears (Conference or Williams) that will hold their shape during poaching. Ripe pears will collapse into a mush.',
    ingredients: [
      '4 firm pears, peeled with stalks intact', '500ml red wine',
      '200ml water', '150g caster sugar', '1 cinnamon stick',
      '3 star anise', '3 cloves', 'zest of 1 orange',
      'vanilla ice cream or crème fraîche, to serve'
    ],
    steps: [
      'Combine wine, water, sugar and spices in a saucepan wide enough to hold the pears. Heat until the sugar dissolves.',
      'Add the peeled pears and bring to a gentle simmer. Cover with a cartouche (circle of baking paper) to keep the pears submerged.',
      'Poach for 20–25 minutes, turning occasionally, until a skewer slides in with no resistance. Cooking time depends on ripeness.',
      'Remove pears and boil the liquid for 10 minutes until reduced to a glossy syrup.',
      'Serve the pears warm or at room temperature with the syrup spooned over. A scoop of vanilla ice cream alongside makes this a complete dessert.'
    ],
    nutrition: { calories: 240, protein: 1, carbs: 52, fat: 0 },
    photo: '/recipe-images/ai-poached-pears-in-spiced-red-wine.jpg'
  },

  // ── STARTERS (8) ──────────────────────────────────────────────────────────

  {
    name: 'Butternut Squash & Ginger Soup', course: 'starter',
    time: '35 min', minutes: 35, protein: 'veggie', cuisine: 'british', carb: 'bread', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'Silky, vivid orange soup with a warming ginger lift and a swirl of cream. The kind of soup that makes everyone think you\'ve been cooking all day, even though it\'s genuinely simple.',
    kidNote: 'Sweet and smooth with no bits — a rare soup that most children will happily eat',
    tip: 'Roast the squash rather than boiling it — roasting concentrates the sweetness and adds a slight caramel note that boiling destroys.',
    ingredients: [
      '1 large butternut squash (about 1kg), peeled and cubed', '1 onion, diced',
      '3 garlic cloves', '4cm piece ginger, grated', '1 litre vegetable stock',
      '2 tbsp olive oil', '½ tsp chilli flakes', 'salt and black pepper',
      'double cream and pumpkin seeds, to serve', 'crusty bread, to serve'
    ],
    steps: [
      'Heat oven to 200°C/180°C fan. Toss squash with 1 tbsp olive oil and seasoning, roast for 25 minutes until tender and starting to caramelise at the edges.',
      'Meanwhile, fry the onion in remaining oil for 8 minutes until soft. Add garlic, ginger and chilli flakes, fry for 2 minutes.',
      'Add the roasted squash to the pan with the stock. Simmer for 5 minutes.',
      'Blend until completely smooth using a stick blender. Adjust consistency with a little more stock if needed. Season well.',
      'Serve in warm bowls with a swirl of cream, a scatter of pumpkin seeds and plenty of crusty bread alongside.'
    ],
    nutrition: { calories: 180, protein: 3, carbs: 28, fat: 7 },
    photo: '/recipe-images/ai-butternut-squash-ginger-soup.jpg'
  },

  {
    name: 'Classic Tomato Soup', course: 'starter',
    time: '30 min', minutes: 30, protein: 'veggie', cuisine: 'british', carb: 'bread', serves: 4,
    description: 'Deeply savoury, velvety tomato soup made from tinned tomatoes roasted with garlic and basil — richer than any carton version and ready in half an hour.',
    kidNote: 'A universal favourite — serve with fingers of buttered bread for dipping',
    tip: 'A pinch of sugar balances the acidity from tinned tomatoes, but taste first — good-quality tins often don\'t need it.',
    ingredients: [
      '2 x 400g tins whole plum tomatoes', '1 onion, diced', '4 garlic cloves',
      '2 tbsp olive oil', '1 tbsp tomato purée', '500ml vegetable stock',
      '1 tsp sugar (optional)', 'handful of fresh basil', 'salt and black pepper',
      'cream and basil oil, to serve', 'crusty bread, to serve'
    ],
    steps: [
      'Heat the olive oil in a large saucepan. Fry the onion for 8 minutes until soft and translucent, then add garlic for 2 more minutes.',
      'Add tomato purée and cook for 1 minute, then tip in the tinned tomatoes, crushing them with the back of a spoon.',
      'Add the stock and most of the basil. Season and simmer for 15 minutes.',
      'Blend until completely smooth. Taste and add a pinch of sugar if the tomatoes are too acidic. Adjust seasoning.',
      'Serve in warm bowls with a swirl of cream, a basil leaf and plenty of crusty bread.'
    ],
    nutrition: { calories: 140, protein: 3, carbs: 18, fat: 7 },
    photo: '/recipe-images/ai-classic-tomato-soup.jpg'
  },

  {
    name: 'Leek & Potato Soup', course: 'starter',
    time: '30 min', minutes: 30, protein: 'veggie', cuisine: 'british', carb: 'none', serves: 4,
    seasons: ['autumn', 'winter'],
    description: 'The gentlest of soups — sweet leek and floury potato simmered in good stock until silky. Served hot it\'s comfort itself; served cold it becomes vichyssoise.',
    kidNote: 'Mild, smooth and filling — almost no children dislike this soup',
    tip: 'Wash leeks thoroughly after slicing — grit hides between the layers and ruins the smooth final texture.',
    ingredients: [
      '4 leeks, trimmed, cleaned and sliced', '3 medium potatoes, peeled and diced',
      '1 onion, diced', '2 garlic cloves', '1 litre vegetable or chicken stock',
      '50ml double cream', '2 tbsp butter', 'salt and white pepper',
      'chives and cream, to serve'
    ],
    steps: [
      'Melt butter in a large saucepan over medium heat. Add onion and leeks, cover and sweat gently for 10 minutes until completely soft but not coloured.',
      'Add garlic and potatoes, stir to coat. Pour over the stock and bring to a simmer.',
      'Cook for 15 minutes until the potatoes are completely tender.',
      'Blend until smooth — for an extra-silky result, pass through a sieve. Stir in the cream and season with salt and white pepper.',
      'Reheat gently without boiling. Serve with snipped chives and a swirl of cream.'
    ],
    nutrition: { calories: 190, protein: 4, carbs: 28, fat: 8 },
    photo: '/recipe-images/ai-leek-potato-soup.jpg'
  },

  {
    name: 'Gazpacho', course: 'starter',
    time: '15 min', minutes: 15, protein: 'veggie', cuisine: 'other', carb: 'bread', serves: 4,
    seasons: ['spring', 'summer'],
    description: 'Spain\'s great chilled soup — ripe tomatoes, cucumber, pepper and good olive oil blended until silky and vibrant. Served ice cold with crisp croutons on a hot day, nothing is more refreshing.',
    kidNote: 'The cold temperature and intensity can be off-putting for young children — serve in small glasses as a taster',
    adult: false,
    tip: 'The quality of the tomatoes is everything — this is a summer recipe, not one for year-round. Use the ripest, most fragrant tomatoes you can find.',
    ingredients: [
      '800g ripe plum tomatoes', '1 cucumber, roughly chopped',
      '1 red pepper, deseeded and roughly chopped', '2 garlic cloves',
      '3 tbsp sherry vinegar', '6 tbsp good extra-virgin olive oil',
      '1 slice stale white bread, soaked in water', 'salt and black pepper',
      'croutons, diced cucumber and a drizzle of olive oil, to serve'
    ],
    steps: [
      'Roughly chop the tomatoes, cucumber, pepper and garlic. Squeeze the soaked bread to remove excess water.',
      'Blend everything together with the olive oil and vinegar until very smooth — at least 2 minutes in a blender.',
      'Season generously with salt and black pepper. Taste and adjust vinegar — it should be bright and acidic.',
      'Push through a sieve for a silky result, pressing firmly to extract as much liquid as possible. Discard the solids.',
      'Chill for at least 2 hours until very cold. Serve in chilled bowls or glasses with croutons, diced cucumber and a drizzle of olive oil.'
    ],
    nutrition: { calories: 180, protein: 3, carbs: 14, fat: 13 },
    photo: '/recipe-images/ai-gazpacho.jpg'
  },

  {
    name: 'Smoked Mackerel Pâté on Toast', course: 'starter',
    time: '10 min', minutes: 10, protein: 'fish', cuisine: 'british', carb: 'bread', serves: 4,
    description: 'Rich, smoky, assertive pâté made from smoked mackerel with cream cheese, lemon and horseradish — ready in 10 minutes, tastes like you planned something elaborate.',
    kidNote: 'The smokiness can be strong for children — milder smoked salmon works well as a swap',
    tip: 'Don\'t over-process — you want a rough, textured pâté, not a smooth paste. Pulse briefly and leave some flakes visible.',
    ingredients: [
      '250g smoked mackerel fillets, skin removed', '150g cream cheese',
      '2 tbsp crème fraîche', '1 tbsp horseradish sauce', 'juice of ½ lemon',
      'black pepper', '4 thick slices sourdough or rye bread',
      'thinly sliced cucumber, capers and lemon wedges, to serve'
    ],
    steps: [
      'Break the mackerel into pieces, removing any bones. Place in a food processor with cream cheese, crème fraîche, horseradish and lemon juice.',
      'Pulse briefly — 4–5 short pulses — until combined but still slightly chunky. Season with black pepper (it won\'t need salt — the mackerel provides plenty).',
      'Taste and adjust lemon and horseradish to your preference.',
      'Toast the bread until crisp. Spread generously with the pâté.',
      'Serve topped with thin slices of cucumber, a few capers and a wedge of lemon on the side.'
    ],
    nutrition: { calories: 340, protein: 18, carbs: 22, fat: 22 },
    photo: '/recipe-images/ai-smoked-mackerel-pate-on-toast.jpg'
  },

  {
    name: 'Salt & Pepper Squid', course: 'starter',
    time: '20 min', minutes: 20, protein: 'seafood', cuisine: 'asian', carb: 'none', serves: 4,
    description: 'Crispy, lightly battered squid rings with a fierce hit of white pepper, five-spice and chilli. The batter is feather-light and shatters on first bite.',
    kidNote: 'Children who enjoy calamari tend to love this — serve with sweet chilli sauce as a dip rather than the chilli-forward adult version',
    tip: 'Dry the squid thoroughly before coating — moisture is the enemy of crispiness. Pat dry, dust, fry immediately.',
    ingredients: [
      '500g squid, cleaned and cut into rings', '75g cornflour',
      '75g plain flour', '1 tsp white pepper', '1 tsp five-spice powder',
      '1 tsp salt', '1 tsp chilli flakes', '1 litre vegetable oil for frying',
      '2 spring onions, finely sliced', '1 red chilli, sliced',
      'lemon wedges and sweet chilli sauce, to serve'
    ],
    steps: [
      'Pat the squid rings completely dry with kitchen paper. Mix cornflour, plain flour, white pepper, five-spice, salt and chilli flakes together.',
      'Heat the oil to 190°C in a deep pan.',
      'Toss the squid in the flour mixture in batches, shaking off any excess.',
      'Fry in batches for 90 seconds until crispy and just golden. Don\'t overcrowd or the temperature drops and the squid steams instead of frying. Drain on kitchen paper.',
      'Serve immediately scattered with spring onions and chilli, with lemon wedges and sweet chilli sauce alongside.'
    ],
    nutrition: { calories: 290, protein: 22, carbs: 24, fat: 11 },
    photo: '/recipe-images/ai-salt-pepper-squid.jpg'
  },

  {
    name: 'Whipped Feta with Honey, Chilli & Flatbread', course: 'starter',
    time: '10 min', minutes: 10, protein: 'veggie', cuisine: 'middleeastern', carb: 'bread', serves: 4,
    description: 'Creamy, smooth whipped feta drizzled with warm honey and chilli flakes — the sweet-salty-spicy combination is one of the most compelling in mezze. Takes 10 minutes and impresses every time.',
    kidNote: 'Make a plain whipped feta version without chilli for children — the honey and flatbread combination is one they tend to love',
    tip: 'Block feta gives a better result than pre-crumbled — it has lower water content and whips into a smoother, creamier consistency.',
    ingredients: [
      '200g good-quality feta cheese', '150g cream cheese',
      '2 tbsp olive oil', '1 tbsp lemon juice',
      '3 tbsp honey', '1 tsp chilli flakes', 'fresh thyme leaves',
      '4 flatbreads or pitta, warmed', 'extra olive oil to serve'
    ],
    steps: [
      'Blend feta, cream cheese, olive oil and lemon juice in a food processor until very smooth and creamy, about 2 minutes. Taste and season with black pepper.',
      'Warm the flatbreads in a dry pan or under the grill.',
      'Warm the honey briefly in a small pan or microwave until runny.',
      'Spread the whipped feta onto a plate or board in swooping motions.',
      'Drizzle with warm honey and olive oil, scatter with chilli flakes and fresh thyme. Serve immediately with the warm flatbreads for dipping.'
    ],
    nutrition: { calories: 390, protein: 12, carbs: 34, fat: 24 },
    photo: '/recipe-images/ai-whipped-feta-with-honey-chilli-flatbread.jpg'
  },

  {
    name: 'Prawn Toast with Sweet Chilli Sauce', course: 'starter',
    time: '20 min', minutes: 20, protein: 'seafood', cuisine: 'asian', carb: 'bread', serves: 4,
    description: 'Golden, prawn-coated toast with a crisp sesame crust — the Chinese takeaway classic made at home, where it\'s always better. Ready in 20 minutes.',
    kidNote: 'A takeaway favourite that most children love — the mild prawn and sesame flavour is very approachable',
    tip: 'Press the sesame seeds on firmly before frying — they need good contact with the prawn paste or they\'ll fall off in the oil.',
    ingredients: [
      '250g raw prawns, shelled', '1 egg white', '1 tbsp soy sauce',
      '1 tsp sesame oil', '2 spring onions, roughly chopped',
      '1cm ginger, grated', '6 slices white bread, crusts removed',
      '75g sesame seeds', '500ml vegetable oil for frying',
      'sweet chilli sauce, to serve'
    ],
    steps: [
      'Blend prawns, egg white, soy sauce, sesame oil, spring onions and ginger to a rough paste — leave some texture.',
      'Spread the prawn mixture thickly and evenly onto each slice of bread right to the edges.',
      'Scatter sesame seeds over the prawn side and press firmly so they adhere.',
      'Heat the oil in a wok or deep frying pan to 180°C. Fry the toasts prawn-side down for 2 minutes, then flip and fry for 1 more minute until golden all over. Drain on kitchen paper.',
      'Cut into triangles and serve hot with sweet chilli sauce.'
    ],
    nutrition: { calories: 310, protein: 16, carbs: 22, fat: 18 },
    photo: '/recipe-images/ai-prawn-toast-with-sweet-chilli-sauce.jpg'
  },

  // ── INDIAN MAINS (6) ──────────────────────────────────────────────────────

  {
    name: 'Chicken Tikka Masala', course: 'main',
    time: '40 min', minutes: 40, protein: 'chicken', cuisine: 'indian', carb: 'rice', serves: 4,
    description: 'Tender charred chicken in a rich, gently spiced tomato and cream sauce — Britain\'s adopted national dish, done properly. The tikka marinade is non-negotiable.',
    kidNote: 'Genuinely one of the best mild curries for children — keep the chilli low and serve with plain rice and naan',
    tip: 'Char the marinated chicken under the grill or in a very hot pan before adding to the sauce — the caramelised edges add a smoky depth that distinguishes tikka masala from a simple chicken curry.',
    ingredients: [
      '600g chicken thighs, cut into chunks',
      '150g full-fat yoghurt', '2 tbsp tikka masala paste',
      '1 onion, finely diced', '3 garlic cloves, grated', '2cm ginger, grated',
      '2 tbsp tikka masala paste (for the sauce)', '400g tin chopped tomatoes',
      '150ml double cream', '1 tsp sugar', '2 tbsp vegetable oil',
      '1 tsp garam masala', 'fresh coriander', 'basmati rice and naan, to serve'
    ],
    steps: [
      'Marinate the chicken in yoghurt, 2 tbsp tikka paste and a pinch of salt for at least 30 minutes. Grill or pan-fry over very high heat until charred in spots, about 8–10 minutes. Set aside.',
      'Fry the onion in oil for 10 minutes until deeply golden. Add garlic and ginger for 2 minutes, then add the remaining tikka paste and cook for another 2 minutes.',
      'Add the tomatoes, stir well and simmer for 15 minutes until the sauce is thick and rich.',
      'Stir in cream and sugar, simmer for 5 minutes. Add the charred chicken and any resting juices, simmer for 5 more minutes.',
      'Finish with garam masala and fresh coriander. Serve with basmati rice and warm naan.'
    ],
    nutrition: { calories: 540, protein: 42, carbs: 22, fat: 30 },
    photo: '/recipe-images/ai-chicken-tikka-masala.jpg'
  },

  {
    name: 'Lamb Biryani', course: 'main',
    time: '75 min', minutes: 75, protein: 'lamb', cuisine: 'indian', carb: 'rice', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'Fragrant, layered rice and slow-cooked spiced lamb, sealed and finished in the oven — the great ceremonial dish of Indian cooking. Worthy of any occasion.',
    kidNote: 'Make a small portion of plain rice alongside for children unused to the strong spices — the lamb is tender and mild if they try it',
    tip: 'The dum (sealed steam cooking) is what makes biryani — seal the pot tightly with foil under the lid so no steam escapes. This is what perfumes the rice from below.',
    ingredients: [
      '800g lamb shoulder, cut into chunks', '400g basmati rice, soaked 30 minutes',
      '2 onions, thinly sliced', '150g yoghurt', '3 tbsp biryani masala or curry paste',
      '4 garlic cloves, grated', '3cm ginger, grated', '1 tsp saffron in 4 tbsp warm milk',
      '4 tbsp ghee or butter', '2 bay leaves', '4 cardamom pods',
      '1 cinnamon stick', 'handful of mint and coriander leaves',
      '3 tbsp fried crispy onions (shop-bought or homemade)'
    ],
    steps: [
      'Marinate lamb in yoghurt, biryani masala, garlic, ginger and salt for at least 1 hour. Fry sliced onions in ghee until deep golden and crispy — this takes 20 minutes. Set half aside for topping.',
      'In the same pan, cook the marinated lamb with remaining onions for 20 minutes until tender. Add a splash of water if needed.',
      'Par-cook the drained rice in well-salted boiling water with bay leaves, cardamom and cinnamon for 6 minutes — it should still have a firm bite. Drain.',
      'Heat oven to 180°C. Layer half the rice over the lamb in an oven-safe pot. Scatter with mint, coriander and half the fried onions. Add remaining rice, drizzle saffron milk over the top.',
      'Seal tightly with foil and a lid. Bake for 25 minutes. Serve at the table, breaking through the layers with a large spoon. Top with remaining crispy onions.'
    ],
    nutrition: { calories: 620, protein: 38, carbs: 64, fat: 22 },
    photo: '/recipe-images/ai-lamb-biryani.jpg'
  },

  {
    name: 'Aloo Gobi', course: 'main',
    time: '30 min', minutes: 30, protein: 'veggie', cuisine: 'indian', carb: 'bread', serves: 4,
    description: 'Dry-spiced potato and cauliflower — one of the great vegetarian curries and proof that a dish doesn\'t need sauce to be deeply satisfying. Golden, fragrant, and ready in half an hour.',
    kidNote: 'A mild, fragrant curry that\'s a good introduction to Indian spicing for children — the golden potato and cauliflower are familiar and comforting',
    tip: 'Don\'t add water — this is a dry curry. The cauliflower and potatoes steam in the moisture from the lid. If it catches, add a tiny splash, no more.',
    ingredients: [
      '1 large cauliflower, cut into florets', '3 medium potatoes, peeled and cubed',
      '1 onion, thinly sliced', '3 garlic cloves, grated', '2cm ginger, grated',
      '2 tsp cumin seeds', '1 tsp turmeric', '1 tsp ground coriander',
      '1 tsp garam masala', '1 tsp chilli flakes',
      '3 tbsp vegetable oil', 'fresh coriander', 'naan or chapati, to serve'
    ],
    steps: [
      'Heat oil in a large lidded pan over medium-high heat. Add cumin seeds and fry for 30 seconds until they pop. Add the onion and cook for 8 minutes until golden.',
      'Add garlic and ginger, cook for 1 minute. Add turmeric, ground coriander and chilli flakes, stir for 30 seconds.',
      'Add potatoes and stir to coat in the spices. Cover and cook for 8 minutes, stirring occasionally.',
      'Add cauliflower florets, stir well, replace the lid and cook for another 10 minutes until both vegetables are tender and slightly golden.',
      'Season, stir in garam masala and fresh coriander. Serve with warm naan or chapati.'
    ],
    nutrition: { calories: 280, protein: 8, carbs: 42, fat: 10 },
    photo: '/recipe-images/ai-aloo-gobi.jpg'
  },

  {
    name: 'Paneer Tikka Masala', course: 'main',
    time: '35 min', minutes: 35, protein: 'veggie', cuisine: 'indian', carb: 'rice', serves: 4,
    description: 'Charred, golden paneer in the same creamy tomato masala sauce as the chicken classic. Vegetarian without compromise — the charred edges of the paneer are the whole point.',
    kidNote: 'Paneer has a mild, milky flavour that most children take to immediately — reduce the chilli and this is a reliable family curry',
    tip: 'Pan-fry or grill the paneer until genuinely golden before adding to the sauce — soft, pale paneer in masala sauce lacks the texture contrast that makes this dish special.',
    ingredients: [
      '400g paneer, cut into cubes', '150g yoghurt',
      '2 tbsp tikka masala paste (for marinade)', '1 onion, finely diced',
      '3 garlic cloves, grated', '2cm ginger, grated',
      '2 tbsp tikka masala paste (for sauce)', '400g tin chopped tomatoes',
      '150ml double cream', '1 tsp sugar', '2 tbsp vegetable oil',
      '1 tsp garam masala', 'fresh coriander', 'basmati rice and naan, to serve'
    ],
    steps: [
      'Marinate the paneer cubes in yoghurt, 2 tbsp tikka paste and a pinch of salt for 15 minutes. Pan-fry over high heat for 2–3 minutes per side until golden and charred. Set aside.',
      'Fry the onion in oil for 8 minutes until golden. Add garlic and ginger for 2 minutes, then remaining tikka paste and cook for 2 more minutes.',
      'Add the tomatoes and simmer for 15 minutes until the sauce is thick.',
      'Stir in cream and sugar, simmer for 5 minutes. Add the paneer, stir gently to coat without breaking up.',
      'Finish with garam masala and fresh coriander. Serve with basmati rice and warm naan.'
    ],
    nutrition: { calories: 490, protein: 24, carbs: 22, fat: 34 },
    photo: '/recipe-images/ai-paneer-tikka-masala.jpg'
  },

  {
    name: 'King Prawn Masala', course: 'main',
    time: '25 min', minutes: 25, protein: 'seafood', cuisine: 'indian', carb: 'rice', serves: 4,
    seasons: ['spring', 'summer'],
    description: 'Plump king prawns in a quick, fragrant tomato and coconut masala — one of the fastest proper curries you can make. The prawns need only minutes so the whole dish is done in under half an hour.',
    kidNote: 'Reduce chilli to a pinch — the coconut milk sweetness makes this a good mild curry for children who like prawns',
    tip: 'Add the prawns last and only cook until just pink — overcooked prawns turn rubbery and that\'s the only thing that can go wrong with this dish.',
    ingredients: [
      '400g raw king prawns, shelled and deveined', '1 onion, finely diced',
      '3 garlic cloves, grated', '2cm ginger, grated', '400g tin chopped tomatoes',
      '200ml coconut milk', '2 tbsp curry paste (Madras or Rogan Josh)',
      '1 tsp cumin seeds', '1 tsp turmeric', '2 tbsp vegetable oil',
      'fresh coriander', 'basmati rice and naan, to serve'
    ],
    steps: [
      'Heat oil in a pan, add cumin seeds for 30 seconds. Add the onion and cook for 8 minutes until golden.',
      'Add garlic, ginger and turmeric, cook for 1 minute. Add the curry paste and fry for 2 minutes.',
      'Add tomatoes and simmer for 8 minutes until the sauce thickens. Pour in coconut milk and simmer for 3 more minutes.',
      'Add the prawns and cook for 3–4 minutes just until they turn pink and opaque throughout. Remove from heat immediately.',
      'Season, scatter with fresh coriander and serve with basmati rice and warm naan.'
    ],
    nutrition: { calories: 360, protein: 28, carbs: 24, fat: 16 },
    photo: '/recipe-images/ai-king-prawn-masala.jpg'
  },

  {
    name: 'Chicken Korma', course: 'main',
    time: '40 min', minutes: 40, protein: 'chicken', cuisine: 'indian', carb: 'rice', serves: 4,
    description: 'Gentle, fragrant, lightly spiced chicken in a rich almond and cream sauce — the great mild curry. Deeply flavoured without heat, and one that converts reluctant curry eaters.',
    kidNote: 'The definitive curry for children and spice-averse adults — mildly sweet, creamy and deeply satisfying',
    tip: 'Ground almonds are the thickener and give korma its characteristic richness — don\'t substitute them. Blending the onion mixture to a paste before frying creates the silky base.',
    ingredients: [
      '600g chicken thighs, cut into chunks', '2 onions, roughly chopped',
      '4 garlic cloves', '3cm ginger', '50g ground almonds',
      '150ml double cream', '150g full-fat yoghurt', '2 tbsp vegetable oil',
      '4 cardamom pods', '1 cinnamon stick', '2 bay leaves',
      '1 tsp cumin', '1 tsp coriander', '½ tsp turmeric', '1 tsp garam masala',
      'basmati rice and naan, to serve', 'toasted flaked almonds, to garnish'
    ],
    steps: [
      'Blend the onions, garlic and ginger to a smooth paste. Fry the cardamom, cinnamon and bay leaves in oil for 1 minute, then add the paste. Cook for 12–15 minutes, stirring frequently, until deeply golden and reduced.',
      'Add cumin, coriander and turmeric, fry for 1 minute. Add the chicken and stir to coat. Cook for 5 minutes.',
      'Stir in yoghurt, a spoonful at a time to prevent splitting. Add ground almonds and 150ml water. Simmer for 15 minutes until the chicken is cooked through.',
      'Stir in cream and garam masala. Simmer gently for 5 minutes — do not boil.',
      'Serve with basmati rice and naan, garnished with toasted flaked almonds.'
    ],
    nutrition: { calories: 560, protein: 40, carbs: 20, fat: 36 },
    photo: '/recipe-images/ai-chicken-korma.jpg'
  },

  // ── AMERICAN VEGGIE (4) ───────────────────────────────────────────────────

  {
    name: 'Three-Bean Veggie Chilli', course: 'main',
    time: '40 min', minutes: 40, protein: 'veggie', cuisine: 'american', carb: 'rice', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'A deep, smoky chilli built on three kinds of beans with chipotle, cumin and dark chocolate — rich and satisfying enough that nobody misses the meat. Better the next day, if it lasts that long.',
    kidNote: 'Make a milder batch or set aside a portion before adding extra chilli — serve with plain rice and soured cream to cool it down',
    tip: 'A square of dark chocolate stirred in at the end sounds odd but adds a roundness and depth that\'s hard to identify but impossible to replicate otherwise.',
    ingredients: [
      '400g tin kidney beans, drained', '400g tin black beans, drained',
      '400g tin borlotti or pinto beans, drained', '2 x 400g tins chopped tomatoes',
      '1 onion, diced', '3 garlic cloves', '2 peppers, diced',
      '2 tbsp chipotle paste', '2 tsp cumin', '2 tsp smoked paprika',
      '1 tsp oregano', '20g dark chocolate', '2 tbsp vegetable oil',
      'soured cream, cheddar, coriander and rice, to serve'
    ],
    steps: [
      'Fry the onion and peppers in oil for 8 minutes. Add garlic, cumin, smoked paprika and oregano, cook for 2 minutes.',
      'Add chipotle paste and fry for 1 minute. Add the tomatoes and all three drained beans.',
      'Simmer over medium heat for 25 minutes, stirring occasionally, until the sauce is thick and the beans are beginning to break down at the edges.',
      'Stir in the dark chocolate until melted. Season generously — this chilli needs bold seasoning.',
      'Serve with rice, a spoonful of soured cream, grated cheddar and fresh coriander.'
    ],
    nutrition: { calories: 390, protein: 21, carbs: 58, fat: 9 },
    photo: '/recipe-images/ai-three-bean-veggie-chilli.jpg'
  },

  {
    name: 'Buffalo Cauliflower with Blue Cheese Dip', course: 'main',
    time: '35 min', minutes: 35, protein: 'veggie', cuisine: 'american', carb: 'none', serves: 4,
    description: 'Cauliflower florets roasted until tender, then tossed in sticky hot sauce and finished under the grill until caramelised. Served with a proper blue cheese dipping sauce — the full buffalo experience without the wings.',
    kidNote: 'Make a mild version with honey and soy instead of hot sauce — the sticky-glazed cauliflower is just as appealing',
    tip: 'Roast the cauliflower well before adding the sauce — if it goes in underdone, the sauce makes it steam rather than caramelise.',
    ingredients: [
      '1 large cauliflower, cut into florets', '4 tbsp hot sauce (Frank\'s or Tabasco)',
      '2 tbsp butter, melted', '1 tbsp honey', '2 tbsp vegetable oil',
      '100g blue cheese (gorgonzola or stilton)', '100ml soured cream',
      '2 tbsp mayonnaise', '1 tbsp lemon juice',
      'celery sticks and carrot sticks, to serve'
    ],
    steps: [
      'Heat oven to 220°C/200°C fan. Toss cauliflower with vegetable oil and seasoning. Roast for 20–25 minutes until golden and tender.',
      'Make the dip: mash blue cheese into soured cream and mayonnaise. Add lemon juice and a pinch of pepper. Stir until combined but still slightly chunky.',
      'Mix hot sauce, melted butter and honey together.',
      'Toss the roasted cauliflower in the buffalo sauce, return to the baking tray and grill for 5 minutes until sticky and slightly charred.',
      'Serve immediately with the blue cheese dip and celery and carrot sticks alongside.'
    ],
    nutrition: { calories: 320, protein: 12, carbs: 18, fat: 24 },
    photo: '/recipe-images/ai-buffalo-cauliflower-with-blue-cheese-dip.jpg'
  },

  {
    name: 'Loaded Sweet Potato Skins', course: 'main',
    time: '55 min', minutes: 55, protein: 'veggie', cuisine: 'american', carb: 'potato', serves: 4,
    seasons: ['autumn', 'winter'],
    description: 'Crispy baked sweet potato skins filled with spiced black beans, melted cheddar, soured cream and avocado. Substantial enough for a main, fun to eat and naturally colourful.',
    kidNote: 'The sweet potato, cheese and avocado combination is a reliable hit with children — let them add their own toppings',
    tip: 'Rub the outside of the sweet potatoes with oil and salt before baking — it crisps the skin rather than leaving it leathery.',
    ingredients: [
      '4 large sweet potatoes', '400g tin black beans, drained',
      '1 tsp cumin', '1 tsp smoked paprika', '100g cheddar, grated',
      '2 tbsp olive oil', '2 avocados', '1 lime',
      'soured cream, to serve', 'small bunch of coriander',
      '1 red chilli, sliced (optional)'
    ],
    steps: [
      'Heat oven to 200°C/180°C fan. Rub the sweet potatoes with olive oil and salt. Bake for 45 minutes until completely tender.',
      'Halve the potatoes and scoop out most of the flesh, leaving a 1cm shell. Toss the skins with a little more oil and return to the oven for 10 minutes to crisp.',
      'Mix the scooped flesh with drained black beans, cumin, smoked paprika and seasoning.',
      'Fill the crispy skins with the bean mixture, top with grated cheddar. Grill for 5 minutes until the cheese is melted and bubbling.',
      'Mash avocado with lime juice and salt. Serve the skins topped with avocado, soured cream, coriander and chilli.'
    ],
    nutrition: { calories: 490, protein: 16, carbs: 68, fat: 19 },
    photo: '/recipe-images/ai-loaded-sweet-potato-skins.jpg'
  },

  {
    name: 'Classic American Veggie Burger', course: 'main',
    time: '30 min', minutes: 30, protein: 'veggie', cuisine: 'american', carb: 'bread', serves: 4,
    description: 'A proper bean and mushroom burger with a crust, a yielding interior and all the classic toppings — a veggie burger worth ordering over its meat equivalent.',
    kidNote: 'Children who like burgers generally take to these — keep the toppings classic and familiar',
    tip: 'Chill the patties for at least 20 minutes before frying — it firms them up so they hold together in the pan rather than crumbling.',
    ingredients: [
      '2 x 400g tins kidney or black beans, drained and dried well',
      '200g chestnut mushrooms, finely diced', '1 onion, finely diced',
      '2 garlic cloves, grated', '75g breadcrumbs', '1 egg',
      '2 tbsp soy sauce', '1 tsp smoked paprika', '1 tsp cumin',
      '2 tbsp vegetable oil', '4 brioche burger buns',
      'burger cheese, lettuce, tomato, pickles and ketchup, to serve'
    ],
    steps: [
      'Fry the onion and mushrooms over high heat for 8 minutes until the mushrooms are completely dry and golden. Add garlic for 1 minute. Cool slightly.',
      'Mash the beans in a large bowl until roughly smooth — leave some texture. Add the mushroom mixture, breadcrumbs, egg, soy sauce, paprika and cumin. Mix well.',
      'Shape into 4 patties, pressing firmly. Refrigerate for 20 minutes to firm up.',
      'Fry in oil over medium heat for 4 minutes per side until a dark crust forms. Add cheese for the last minute to melt.',
      'Serve in toasted brioche buns with lettuce, tomato, pickles and ketchup.'
    ],
    nutrition: { calories: 540, protein: 24, carbs: 74, fat: 17 },
    photo: '/recipe-images/ai-classic-american-veggie-burger.jpg'
  },

  // ── LAMB DISHES (6) ───────────────────────────────────────────────────────

  {
    name: 'Shepherd\'s Pie', course: 'main',
    time: '60 min', minutes: 60, protein: 'lamb', cuisine: 'british', carb: 'potato', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'Slow-cooked minced lamb with root vegetables in a rich, herby gravy, topped with a golden, butter-whipped mash — the definitive British winter supper. This is what shepherd\'s pie is supposed to be.',
    kidNote: 'One of the most reliably popular family meals — children who reject other lamb dishes almost always like shepherd\'s pie',
    tip: 'Use lamb mince with some fat content — lean mince produces a dry, disappointing filling. And make the mash deliberately rich: this is not the dish for restraint.',
    ingredients: [
      '700g lamb mince', '2 onions, diced', '2 carrots, diced',
      '2 celery sticks, diced', '3 garlic cloves', '2 tbsp tomato purée',
      '200ml red wine', '300ml lamb or beef stock', '1 tbsp Worcestershire sauce',
      '2 bay leaves', '1 tsp fresh thyme', '2 tbsp vegetable oil',
      '1kg Maris Piper potatoes, peeled', '75g butter', '100ml whole milk',
      'salt and black pepper'
    ],
    steps: [
      'Heat oil in a large casserole. Fry the lamb mince over high heat until browned, breaking up with a spoon. Remove and set aside. In the same pan, fry onion, carrot and celery for 8 minutes.',
      'Add garlic and tomato purée, cook for 2 minutes. Return the lamb. Add wine and bubble for 3 minutes. Add stock, Worcestershire sauce, bay leaves and thyme.',
      'Simmer uncovered for 25 minutes until the gravy is rich and thick. Season well.',
      'Meanwhile, boil potatoes until tender, drain well and steam-dry for 2 minutes. Mash with butter and milk until smooth and silky. Season generously.',
      'Transfer the filling to a baking dish. Top with mash, rough up the surface with a fork. Bake at 200°C/180°C fan for 25 minutes until golden and bubbling at the edges.'
    ],
    nutrition: { calories: 570, protein: 32, carbs: 42, fat: 28 },
    photo: '/recipe-images/ai-shepherds-pie.jpg'
  },

  {
    name: 'Lancashire Hotpot', course: 'main',
    time: '120 min', minutes: 120, protein: 'lamb', cuisine: 'british', carb: 'potato', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'The great northern English braise — lamb neck cutlets and root vegetables slow-cooked under a shingled potato crust until the meat is falling-tender and the top is crisp and golden.',
    kidNote: 'The mild, slow-cooked lamb and potato combination is one children tend to enjoy — serve with red cabbage or peas',
    tip: 'Lamb neck cutlets, not shoulder — the bones and connective tissue melt into the braise and give it a richness that boneless cuts can\'t match.',
    ingredients: [
      '1.2kg lamb neck cutlets', '3 onions, sliced', '2 carrots, sliced',
      '500ml lamb or chicken stock', '1 tbsp Worcestershire sauce',
      '1 tbsp plain flour', '2 bay leaves', '1 tsp fresh thyme',
      '800g Maris Piper potatoes, peeled and thinly sliced',
      '2 tbsp butter', '2 tbsp vegetable oil', 'salt and black pepper'
    ],
    steps: [
      'Heat oven to 170°C/150°C fan. Season the lamb cutlets and brown in oil in a casserole over high heat. Remove. In the same pan, fry onions for 8 minutes until golden.',
      'Sprinkle flour over the onions, stir for 1 minute. Add stock, Worcestershire sauce, carrots, bay and thyme. Return the lamb, nestling the pieces in.',
      'Layer the sliced potatoes in overlapping circles over the top, seasoning each layer. The final layer should be neat and even.',
      'Dot the potato topping with butter. Cover and bake for 1 hour 30 minutes.',
      'Uncover for the final 30 minutes and increase heat to 200°C/180°C fan to crisp and brown the potato crust. Rest for 10 minutes before serving.'
    ],
    nutrition: { calories: 580, protein: 36, carbs: 38, fat: 30 },
    photo: '/recipe-images/ai-lancashire-hotpot.jpg'
  },

  {
    name: 'Lamb & Apricot Tagine', course: 'main',
    time: '90 min', minutes: 90, protein: 'lamb', cuisine: 'middleeastern', carb: 'none', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'Slow-braised lamb shoulder with dried apricots, almonds and warming spices — the great Moroccan tagine. Perfumed with cinnamon and ginger, sweet with fruit, rich with slow-cooked meat.',
    kidNote: 'The sweetness from the apricots makes this an accessible lamb dish for children — serve with plain couscous and they tend to enjoy it',
    tip: 'The longer it cooks, the better — if you have time, an extra 30 minutes only improves it. The lamb should be falling off the bone.',
    ingredients: [
      '1kg lamb shoulder, cut into large chunks', '150g dried apricots',
      '50g flaked almonds, toasted', '2 onions, diced', '3 garlic cloves',
      '2cm ginger, grated', '1 tsp cinnamon', '1 tsp cumin',
      '1 tsp coriander', '½ tsp turmeric', '½ tsp chilli flakes',
      '400ml lamb or chicken stock', '2 tbsp honey', '2 tbsp olive oil',
      'fresh coriander', 'couscous or flatbread, to serve'
    ],
    steps: [
      'Heat oil in a large heavy casserole. Brown the lamb in batches over high heat. Remove and set aside.',
      'In the same pan, fry onions for 8 minutes. Add garlic, ginger and all the spices, cook for 2 minutes until fragrant.',
      'Return the lamb. Add stock, apricots and honey. Bring to a simmer, cover tightly.',
      'Cook on the lowest heat for 75–90 minutes until the lamb is completely tender and falling apart. Check occasionally and add a splash of water if needed.',
      'Scatter over toasted almonds and fresh coriander. Serve with couscous or warm flatbread to mop up the sauce.'
    ],
    nutrition: { calories: 540, protein: 38, carbs: 26, fat: 30 },
    photo: '/recipe-images/ai-lamb-apricot-tagine.jpg'
  },

  {
    name: 'Lamb Shawarma Wraps', course: 'main',
    time: '35 min', minutes: 35, protein: 'lamb', cuisine: 'middleeastern', carb: 'bread', serves: 4,
    description: 'Spiced, charred lamb with garlic sauce, pickled cabbage and chilli in a warm flatbread — the street food of the Middle East, achievable in a home oven. The spice rub is everything.',
    kidNote: 'Pull the lamb into smaller pieces, skip the chilli and serve with just garlic sauce — the flavour is milder and children often love it wrapped in bread',
    tip: 'Rest the lamb well after cooking — 10 minutes under foil allows the juices to redistribute and makes carving much easier.',
    ingredients: [
      '600g lamb leg steaks or boneless shoulder', '2 tsp cumin',
      '2 tsp smoked paprika', '1 tsp turmeric', '1 tsp cinnamon',
      '1 tsp allspice', '3 tbsp olive oil', '4 flatbreads',
      '4 tbsp tahini', '2 garlic cloves, grated', '4 tbsp yoghurt',
      '1 lemon', '¼ red cabbage, finely shredded', '2 tbsp red wine vinegar',
      'fresh parsley', 'chilli sauce, to serve'
    ],
    steps: [
      'Mix cumin, paprika, turmeric, cinnamon, allspice, olive oil and a generous pinch of salt. Coat the lamb thoroughly and marinate for at least 30 minutes.',
      'Quickly pickle the cabbage: toss with vinegar, a pinch of salt and sugar. Leave for 20 minutes.',
      'Make garlic sauce: mix tahini, yoghurt, grated garlic and lemon juice. Loosen with water to a drizzleable consistency.',
      'Cook the lamb under a hot grill or in a griddle pan for 6–8 minutes per side until charred and cooked through. Rest for 10 minutes then slice thinly.',
      'Warm the flatbreads. Spread with garlic sauce, pile on sliced lamb, pickled cabbage and parsley. Drizzle with chilli sauce and roll up.'
    ],
    nutrition: { calories: 580, protein: 38, carbs: 44, fat: 26 },
    photo: '/recipe-images/ai-lamb-shawarma-wraps.jpg'
  },

  {
    name: 'Lamb Meatballs in Spiced Tomato Sauce', course: 'main',
    time: '40 min', minutes: 40, protein: 'lamb', cuisine: 'middleeastern', carb: 'bread', serves: 4,
    description: 'Herby, lightly spiced lamb meatballs simmered in a warm, cinnamon-spiked tomato sauce — serve with flatbread to mop up the sauce and a dollop of thick yoghurt.',
    kidNote: 'Children who like meatballs tend to love these — the spices are warming rather than hot',
    tip: 'Mix the meatball mixture minimally and handle it as little as possible — over-mixing activates the proteins and produces a dense, rubbery texture.',
    ingredients: [
      '500g lamb mince', '1 onion, grated', '3 garlic cloves (2 for meatballs, 1 for sauce)',
      '1 tsp cumin', '1 tsp coriander', '½ tsp cinnamon', '½ tsp chilli flakes',
      '3 tbsp fresh parsley, chopped', '1 egg', '30g breadcrumbs',
      '2 x 400g tins chopped tomatoes', '1 tsp cinnamon', '1 tbsp olive oil',
      'thick yoghurt, fresh mint and flatbread, to serve'
    ],
    steps: [
      'Combine lamb mince, grated onion, 2 garlic cloves, cumin, coriander, cinnamon, chilli, parsley, egg and breadcrumbs. Mix briefly until just combined. Roll into 20 walnut-sized balls.',
      'Brown the meatballs in olive oil in batches over high heat until golden all over. Remove and set aside.',
      'In the same pan, fry the remaining garlic for 1 minute. Add tomatoes and cinnamon, season and simmer for 10 minutes.',
      'Return the meatballs to the sauce. Cover and simmer for 15 minutes until cooked through.',
      'Serve with thick yoghurt, scattered fresh mint and warm flatbreads for mopping.'
    ],
    nutrition: { calories: 480, protein: 30, carbs: 28, fat: 28 },
    photo: '/recipe-images/ai-lamb-meatballs-in-spiced-tomato-sauce.jpg'
  },

  {
    name: 'Slow-Braised Irish Stew', course: 'main',
    time: '120 min', minutes: 120, protein: 'lamb', cuisine: 'british', carb: 'potato', serves: 6,
    seasons: ['autumn', 'winter'],
    description: 'The simplest and most honest of stews — lamb neck, potatoes, onion and stock, cooked low and slow until everything melds into something quietly magnificent.',
    kidNote: 'The mild, gentle flavour of a proper Irish stew is one of the most family-friendly dishes there is',
    tip: 'Resist adding anything else — no wine, no herbs beyond thyme, no tomatoes. The restraint is the point: the lamb and potatoes do all the work.',
    ingredients: [
      '1kg lamb neck or shoulder, cut into chunks', '800g Maris Piper potatoes, peeled and halved',
      '3 onions, sliced', '2 carrots, thickly sliced', '500ml lamb or chicken stock',
      '2 bay leaves', '1 tsp fresh thyme', '2 tbsp plain flour',
      '2 tbsp vegetable oil', 'fresh parsley', 'salt and black pepper'
    ],
    steps: [
      'Season the lamb and dust lightly with flour. Brown in batches in oil over high heat. Remove and set aside.',
      'In the same casserole, soften the onions for 5 minutes. Return the lamb. Add stock, bay leaves and thyme. Bring to a gentle simmer.',
      'Cover and cook on the very lowest heat — or in the oven at 160°C/140°C fan — for 1 hour.',
      'Add potatoes and carrots, pushing them into the broth. Cover and cook for a further 45–60 minutes until the potatoes are tender and the lamb is completely falling apart.',
      'Scatter generously with fresh parsley and serve directly from the casserole at the table.'
    ],
    nutrition: { calories: 520, protein: 34, carbs: 38, fat: 24 },
    photo: '/recipe-images/ai-slow-braised-irish-stew.jpg'
  }

];

const updated = [...recipes, ...newRecipes];
fs.writeFileSync('./src/data/recipes.json', JSON.stringify(updated, null, 2));
console.log('Added', newRecipes.length, 'recipes. Total now:', updated.length);
