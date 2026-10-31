import type { Difficulty } from '@vermont/ai';
import type { SaveProblem } from '../save/savedGame';
import type {
  AbilityId,
  Archetype,
  MoraleState,
  RejectionCode,
  TerrainId,
  VictoryReason,
} from '@vermont/core';

/** Word forms for one, two to four, and five or more of something. */
export type PluralForms = readonly [one: string, few: string, many: string];

export interface AbilityText {
  readonly name: string;
  readonly description: string;
}

/**
 * Every text the game shows. Another language is a second object of the same shape; `{name}`
 * marks a value put in at run time.
 */
export const cs = {
  ui: {
    'app.title': 'Vermont',
    'app.subtitle': 'Tahová bitva na hexech',
    'app.version': 'pravidla v{version}',

    'perf.title': 'Výkon (F3)',
    'perf.fps': '{fps} FPS, snímek {ms} ms',
    'perf.drawCalls': 'draw cally {count}',
    'perf.triangles': 'trojúhelníky {count}',
    'perf.memory': 'geometrie {geometries}, textury {textures}',
    'perf.loading': 'Načítám modely…',

    'menu.newBattle': 'Nová bitva',
    'menu.continue': 'Pokračovat v bitvě',
    'menu.settings': 'Nastavení',
    'menu.back': 'Zpět',
    'menu.mainMenu': 'Hlavní menu',
    'menu.restart': 'Hrát znovu',
    'menu.pause': 'Pauza',
    'menu.resume': 'Zpět do bitvy',
    'menu.shortcuts': 'Ovládání',
    'menu.help': 'Nápověda',
    'result.rounds': 'Bitva trvala {rounds} {word}.',
    'result.standing': 'Na poli',
    'result.dead': 'Padlo',
    'result.fled': 'Uteklo',
    'menu.training': 'Výcvik',
    'menu.trainingHint': 'Krátká bitva, ve které tě hra naučí ovládání a pravidla.',
    'tutorial.title': 'Výcvik',
    'tutorial.progress': 'krok {step} z {count}',
    'tutorial.next': 'Další',
    'tutorial.skip': 'Skrýt výcvik',
    'tutorial.welcome':
      'Vítej ve výcviku. Velíš Římu (červené štítky) proti Kartágu (fialové). Vyhraješ, když vstoupíš do tábora soupeře (praporec nad ním, vzdálenost ukazuje horní lišta) nebo rozeženeš celou jeho armádu. Projdeme to krok po kroku.',
    'tutorial.select':
      'Klikni na svou jednotku na mapě nebo v liště armády dole (nebo stiskni Tab). Vlevo dole se ukáže její panel: zdraví, morálka, pohyb a schopnosti. Štítek nad jednotkou ukazuje typ, životy a morálku.',
    'tutorial.move':
      'Bílá čára ohraničuje, kam se jednotka v tomto tahu dostane. Klikni na hex uvnitř a jednotka tam dojde. Kopec před tebou dává obranu a výhled navíc.',
    'tutorial.endTurn':
      'Každá jednotka se může v tahu jednou pohnout a jednou zaútočit. Pohni i ostatními a pak ukonči tah tlačítkem vpravo nahoře nebo Enterem. Jednotky se šedým štítkem už nemůžou nic, v liště dole hned vidíš, kdo ještě může jednat.',
    'tutorial.contact':
      'Soupeř se blíží. Oranžově podbarvený hex značí zónu kontroly: hex vedle nepřítele, kde se jednotka musí zastavit. Postav se k nepříteli.',
    'tutorial.attack':
      'Nepřátelé s červeným kroužkem a rámečkem štítku jsou na dosah. Najeď na cíl myší: karta ukáže ztráty obou stran a co útok zesiluje nebo oslabuje. Klikni a zaútoč.',
    'tutorial.morale':
      'Zásah bere životy (číslo na štítku) i morálku (modrá linka pod ním). Otřesená jednotka (žlutý vykřičník) útočí slabší, zlomená (červený znak ») utíká a neposlouchá. Útoč víc jednotkami na jeden cíl: obklíčení přidává sílu a bere víc morálky.',
    'tutorial.abilities':
      'Schopnosti najdeš v panelu jednotky. Hastáti mají pilum, silnější první útok. Principes umí střídání linie (R): vymění se s unavenou sousední jednotkou.',
    'tutorial.log':
      'Po tahu soupeře ukáže karta vpravo nahoře, co se stalo; klik na řádek ukáže místo na mapě. Celý průběh bitvy otevře tlačítko Události nebo klávesa L, C vrátí kameru na vybranou jednotku a H otevře nápovědu s pravidly.',
    'tutorial.finish': 'Teď dobojuj sám. Hodně štěstí!',
    'tutorial.done': 'Výcvik je za tebou. Vyzkoušej skutečnou bitvu: Trebia je dobrý začátek.',
    'tutorial.toMenu': 'Hlavní menu',
    'help.title': 'Nápověda',
    'help.tab.basics': 'Základy',
    'help.tab.movement': 'Pohyb',
    'help.tab.combat': 'Boj',
    'help.tab.morale': 'Morálka',
    'help.tab.units': 'Jednotky',
    'help.tab.terrain': 'Terén',
    'help.tab.controls': 'Ovládání',
    'help.basics.goal':
      'Vyhraješ, když tvoje bojující jednotka vstoupí do tábora soupeře, nebo když soupeři na bojišti nezůstane žádná jednotka (padly nebo utekly).',
    'help.basics.turns':
      'Strany se střídají v tazích. Ve svém tahu může každá jednotka jednou pohnout a jednou zaútočit, v libovolném pořadí. Tah ukončíš tlačítkem Ukončit tah nebo klávesou Enter.',
    'help.basics.plate':
      'Štítek nad jednotkou: ikona typu v barvě strany (tečky pod ní odliší typy se stejnou ikonou, například principes od hastátů), číslo životů a modrá linka morálky. Žlutý vykřičník znamená otřesenou jednotku, červený znak » jednotku na útěku. Šedý štítek má jednotka, která už v tahu nemůže nic. Stejné štítky jsou v liště armády dole; klik na ně jednotku vybere a ukáže.',
    'help.basics.deploy':
      'Před bitvou rozestavíš armádu ve své zóně. Na jednom hexu stojí vždy jen jedna jednotka.',
    'help.basics.limit':
      'Bitva trvá nejvýš {limit} kol. Když do té doby nikdo nezvítězí, končí remízou.',
    'help.basics.fog':
      'Mlha války: terén vidíš celý, ale nepřátele jen v dohledu svých jednotek a tábora (tábor vidí {campSight} hexy daleko).',
    'help.movement.points':
      'Každá jednotka má body pohybu. Vstup na hex stojí tolik, kolik ukazuje tabulka terénu. Řeka a moře jsou neprůchodné, přejít se dá jen po mostě nebo brodem.',
    'help.movement.zoc':
      'Zóna kontroly: hexy hned vedle nepřítele. Jednotka, která do nich vstoupí, musí zastavit. Na mapě je značí oranžově podbarvené hexy.',
    'help.movement.hill':
      'Z kopce je vidět a střílí se o 1 hex dál. Les, kopec a hory zakrývají výhled.',
    'help.movement.ambush': 'Když jednotka při pohybu narazí na skrytého nepřítele, zastaví se.',
    'help.combat.attack':
      'Na sousední jednotku útočíš zblízka, střelci a vrhači i na dálku podle dostřelu, pokud na cíl vidí a vedle nich nestojí nepřítel.',
    'help.combat.damage':
      'Ztráty závisí na poměru útoku a obrany a na zdraví útočníka (zraněná jednotka bije slaběji). Výsledek se náhodně liší o ±{spread} %.',
    'help.combat.counter':
      'Napadená jednotka v boji zblízka vrací protiútok poloviční silou. Střelba a jednotky s udeř a ustup protiútok nedostanou.',
    'help.combat.types':
      'Typ proti typu: některé typy mají proti jiným výhodu ×{advantage}. Které to jsou, ukazuje sloupec Silná proti v záložce Jednotky.',
    'help.combat.flank':
      'Obklíčení: každý další tvůj bojující voják vedle cíle přidá útoku {flank} %. Natočení jednotek hra nezná.',
    'help.combat.terrain':
      'Útok z kopce dolů má +{downhill}. Jízda a sloni v lese bojují s postihem {hindered}. Obranu cíle zvedá jeho terén.',
    'help.combat.preview':
      'Najeď myší na cíl a karta Odhad útoku ukáže ztráty obou stran, ztrátu morálky cíle a všechno, co útok zesiluje nebo oslabuje.',
    'help.morale.states':
      'Morálka má {max} bodů. Na {shaken} a méně je jednotka otřesená a útočí o {penalty} % slabší. Na {routing} a méně se dá na útěk.',
    'help.morale.loss':
      'Zásah stojí {hit} body morálky, o {encircled} víc při obklíčení ({encircledAt} a více nepřátel kolem), o {worn} víc, když jednotce zbude polovina zdraví nebo méně. Když vedle padne spojenec, ztrácí {allyDies}.',
    'help.morale.gain':
      'Za útok, ve kterém způsobí víc ztrát, než dostane, získá jednotka {won}. Každý tah bez nepřítele vedle sebe se vzpamatuje o {recovery}.',
    'help.morale.rout':
      'Zlomená jednotka hned utíká co nejdál od nepřítele a neposlouchá rozkazy. Na začátku tvého tahu opustí bojiště, pokud stojí vedle nepřítele; jinak se vzpamatuje, ale ten tah stojí.',
    'help.morale.camp': 'Jednotka ve vlastním táboře morálku neztrácí.',
    'help.morale.elephants':
      'Sloni na útěku nejdřív zběsile zaútočí na náhodnou sousední jednotku, i vlastní.',
    'help.units.intro':
      'Čísla jsou výchozí hodnoty typu. Výhodu typu proti typu ukazuje sloupec Silná proti.',
    'help.terrain.intro':
      'Pohyb je cena vstupu na hex, obrana a útok jsou bonusy jednotky, která na hexu stojí.',
    'help.col.unit': 'Jednotka',
    'help.col.type': 'Typ',
    'help.col.strong': 'Silná proti',
    'help.col.terrain': 'Terén',
    'help.col.notes': 'Poznámka',
    'help.note.hill': 'výhled a dostřel +1',
    'help.note.blocksSight': 'kryje výhled',
    'help.note.impassable': 'neprůchodné',
    'help.note.impassableFor': 'neprojde: {archetypes}',
    'help.note.hinders': 'postih pro: {archetypes}',
    'menu.loadFile': 'Načíst bitvu ze souboru',
    'menu.saveFile': 'Uložit bitvu do souboru',

    'scenarios.title': 'Výběr scénáře',
    'scenarios.units': '{count} {units}',
    'scenarios.versus': 'proti',
    'scenarios.opponent': 'Soupeř',
    'scenarios.opponent.computer': 'Počítač',
    'scenarios.opponent.human': 'Druhý hráč u tohoto počítače',
    'scenarios.side': 'Hraješ za',
    'scenarios.difficulty': 'Obtížnost',
    'scenarios.autoDeploy': 'Rozestavit armády automaticky',
    'scenarios.fog': 'Mlha války: každý vidí jen to, co jeho jednotky',
    'scenarios.start': 'Začít bitvu',
    'scenarios.about.trebia':
      'Zimní ráno u řeky Trebie: Hannibal vylákal Římany přes řeku. Bažina uprostřed dělí pole, přes řeku vedou dva brody, otevřený východní okraj láká jízdu. Kartágo má slony a lepší jízdu, Řím o jednotku víc.',
    'scenarios.about.cannae':
      'Široká rovina u Kann, kde Hannibal obklíčil přesilu. Řeka na západním okraji s mostem a brodem, za ní cesta podél křídla. Obě armády mají před sebou kopec. Ideální na obchvat a obklíčení.',
    'scenarios.about.zama':
      'Rozhodující bitva druhé punské války. Scipio proti Hannibalovi a jeho slonům na otevřeném poli s několika kopci a lesy. Jízda tu rozhoduje víc než kdekoli jinde.',

    'settings.title': 'Nastavení',
    'settings.confirmEndTurn': 'Potvrzovat konec tahu, když jednotky ještě mohou jednat',
    'settings.logOpen': 'Zobrazovat log událostí (L)',
    'settings.followComputer': 'Kamera sleduje tah počítače',
    'settings.sound': 'Zvuk',
    'settings.masterVolume': 'Celková hlasitost',
    'settings.effectsVolume': 'Efekty',
    'settings.musicVolume': 'Hudba',
    'settings.ambientVolume': 'Zvuky bojiště',
    'settings.muted': 'Ztlumit vše (M)',

    'hud.round': 'Kolo {turn} z {limit}',
    'hud.deployment': 'Rozestavení',
    'hud.roundLimit': 'Po posledním kole končí bitva remízou.',
    'hud.onTurn': 'na tahu',
    'hud.aiOnTurn': 'počítač táhne…',
    'hud.endTurn': 'Ukončit tah',
    'hud.undo': 'Vrátit',
    'hud.menu': 'Menu',
    'hud.log': 'Události',
    'hud.goal': 'K táboru soupeře: {distance} {hexes}',
    'hud.goalHint':
      'Vstup do tábora soupeře vyhrává bitvu, stejně jako zničení nebo rozprášení jeho armády.',
    'hud.logHint': 'Otevřít nebo zavřít log událostí (L)',
    'hud.terrain': 'Terén',
    'hud.terrainHint': 'Napsat na hexy, jaký je na nich terén a kolik dává obrany (T)',
    'hud.ready': 'Může jednat: {count}',
    'hud.army.fighting': 'v boji {count} z {total}',
    'hud.army.routing': 'na útěku {count}',
    'hud.army.strength': 'Síla armády',
    'hud.confirmEndTurn': 'Některé jednotky ještě mohou jednat ({count}). Opravdu ukončit tah?',
    'hud.confirm': 'Ukončit tah',
    'hud.cancel': 'Zpět',

    'summary.title': 'Tah: {side}, kolo {turn}',
    'summary.close': 'Zavřít shrnutí tahu',
    'summary.more': 'a {count} dalších v logu (L)',
    'summary.damage': '−{damage} {lives}',
    'summary.outcome.steady': 'morálka obnovena',
    'summary.outcome.shaken': 'otřesena',
    'summary.outcome.routing': 'na útěku',
    'summary.outcome.died': 'zničena',
    'summary.outcome.fled': 'opustila bojiště',
    'summary.moves': 'Na pochodu: {count} {units}',
    'summary.hint': 'Klik na řádek ukáže místo na mapě.',

    'army.title': 'Tvoje armáda',
    'army.ready': 'Může jednat {ready} z {total}',
    'army.canAct': 'může jednat',
    'army.spent': 'odehraná',

    'handover.title': 'Na řadě: {side}',
    'handover.deploy': 'Rozestavení armády',
    'handover.turn': 'Kolo {turn}',
    'handover.hint': 'Předej počítač dalšímu hráči. Soupeř se teď nemá dívat.',
    'handover.ready': 'Jsem u počítače',

    'deploy.title': 'Rozestavení',
    'deploy.hint': 'Vyber jednotku a klikni na hex ve své zóně. Postavenou jednotku lze přesunout.',
    'deploy.reserve': 'Čeká na rozestavení: {count}',
    'deploy.allDeployed': 'Všechny jednotky stojí na poli.',
    'deploy.auto': 'Rozestavit automaticky',
    'deploy.confirm': 'Potvrdit rozestavení',

    'unit.hp': 'Zdraví',
    'unit.morale': 'Morálka',
    'unit.movement': 'Pohyb',
    'unit.attack': 'Útok',
    'unit.defense': 'Obrana',
    'unit.range': 'Dostřel',
    'unit.sight': 'Dohled',
    'unit.abilities': 'Schopnosti',
    'unit.hasAttacked': 'Už útočila',
    'unit.canAttack': 'Může útočit',
    'unit.hasMoved': 'Pohnula se',
    'unit.strongAgainst': 'Silná proti:',
    'unit.inReserve': 'V záloze',
    'unit.spent': 'použito',
    'unit.relief': 'Střídání linie',
    'unit.reliefHint': 'Vyber sousední jednotku, se kterou si má vyměnit místo.',
    'unit.reliefCancel': 'Zrušit střídání',

    'tip.moveCost': 'pohyb {cost}',
    'tip.impassable': 'neprůchodné',
    'tip.defense': 'obrana {bonus}',
    'tip.attack': 'útok {bonus}',
    'tip.hill': 'výhled a dostřel +1',
    'tip.blocksSight': 'kryje výhled',
    'tip.camp': 'tábor: {side}',
    'tip.fogged': 'mimo dohled',
    'tip.preview': 'Odhad útoku',
    'tip.kind.melee': 'boj zblízka',
    'tip.kind.ranged': 'střelba',
    'tip.dealt': 'Způsobíš',
    'tip.taken': 'Protiútok',
    'tip.none': 'žádný',
    'tip.targetMorale': 'Morálka cíle {loss}',
    'tip.encircled': 'cíl je obklíčen',
    'tip.mustStop': 'vedle nepřítele: tady se zastavíš',
    'tip.factor.terrainAttack': 'terén útočníka {value}',
    'tip.factor.downhill': 'útok z kopce {value}',
    'tip.factor.hindered': 'nevhodný terén {value}',
    'tip.factor.pilum': 'pilum {value}',
    'tip.factor.furiousCharge': 'zuřivý útok {value}',
    'tip.factor.fear': 'strach ze slonů {value}',
    'tip.factor.terrainDefense': 'terén cíle: obrana {value}',
    'tip.factor.shieldWall': 'štítová hradba: obrana {value}',
    'tip.factor.advantage': 'výhoda typu ×{value}',
    'tip.factor.flank': 'obklíčení: {count} {units} u cíle, +{percent} %',
    'tip.factor.wounded': 'útočník je oslabený',
    'tip.factor.shaken': 'útočník je otřesený',

    'log.title': 'Události',
    'log.empty': 'Zatím se nic nestalo.',
    'log.folded': '{count} ▸',
    'log.battleStarts': 'Bitva začíná.',
    'log.deploymentEnded': '{side}: rozestavení dokončeno.',
    'log.turnStarted': 'Kolo {turn}, na tahu {side}.',
    'log.moved': '{unit}: přesun o {count} {hexes}.',
    'log.ambushed': '{unit}: narazila na skrytého nepřítele a zastavila.',
    'log.attack.melee': '{unit}: útok na {target}, ztráty {damage}.',
    'log.attack.ranged': '{unit}: střelba na {target}, ztráty {damage}.',
    'log.counter': ' Protiútok {damage}.',
    'log.died': '{unit}: jednotka zničena.',
    'log.morale.steady': '{unit}: morálka obnovena.',
    'log.morale.shaken': '{unit}: jednotka otřesena.',
    'log.morale.routing': '{unit}: dává se na útěk.',
    'log.swapped': '{unit}: střídání linie s {target}.',
    'log.rampaged': '{unit}: běsní a zasahuje jednotku {target} za {damage}.',
    'log.retreated': '{unit}: ustupuje před nepřítelem.',
    'log.rallied': '{unit}: znovu v boji.',
    'log.fled': '{unit}: opustila bojiště.',
    'log.battleEnded': '{side} vítězí: {reason}.',

    'log.battleDrawn': 'Remíza: po {rounds} kolech nikdo nezvítězil.',

    'victory.title': 'Vítězství: {side}',
    'draw.title': 'Remíza',

    'keys.title': 'Ovládání',
    'keys.click': 'Klik: výběr jednotky, pohyb, útok',
    'keys.drag': 'Tažení myší: posun mapy, kolečko: zoom',
    'keys.rotate': 'Q / E: otočení mapy',
    'keys.pan': 'W A S D nebo šipky: posun mapy',
    'keys.endTurn': 'Enter: konec tahu, potvrzení rozestavení nebo převzetí počítače',
    'keys.undo': 'Backspace nebo Ctrl+Z: vrátit pohyb',
    'keys.next': 'Tab / Shift+Tab: další a předchozí jednotka, která může jednat',
    'keys.relief': 'R: střídání linie',
    'keys.log': 'L: zobrazit nebo skrýt události',
    'keys.show': 'C: kamera na vybranou jednotku, bez výběru na celou armádu',
    'keys.terrain': 'T: popisky terénu na hexech',
    'keys.escape': 'Esc: zrušit výběr, pak menu',
    'keys.help': 'H: nápověda s pravidly',
    'keys.mute': 'M: ztlumit nebo zapnout zvuk',
  },

  difficulties: {
    easy: 'Lehká',
    normal: 'Střední',
    hard: 'Těžká',
  } satisfies Record<Difficulty, string>,

  plurals: {
    hexes: ['hex', 'hexy', 'hexů'],
    units: ['jednotka', 'jednotky', 'jednotek'],
    rounds: ['kolo', 'kola', 'kol'],
    lives: ['život', 'životy', 'životů'],
  } satisfies Record<string, PluralForms>,

  /** By the id from the game data; an id missing here shows the name from the data. */
  factions: {
    rome: 'Řím',
    carthage: 'Kartágo',
  } as Readonly<Record<string, string>>,

  scenarios: {
    trebia: 'Trebia (218 př. n. l.)',
    cannae: 'Kanny (216 př. n. l.)',
    zama: 'Zama (202 př. n. l.)',
    training: 'Výcvik',
  } as Readonly<Record<string, string>>,

  unitTypes: {
    velites: 'Velité',
    hastati: 'Hastati',
    principes: 'Principes',
    triarii: 'Triarii',
    equites: 'Equites',
    'balearic-slingers': 'Baleárští prakovníci',
    'libyan-spearmen': 'Libyjští kopiníci',
    'gallic-mercenaries': 'Galští žoldnéři',
    'numidian-cavalry': 'Numidská jízda',
    'iberian-cavalry': 'Iberská jízda',
    'war-elephants': 'Váleční sloni',
  } as Readonly<Record<string, string>>,

  archetypes: {
    spear: 'Kopiníci',
    heavyInfantry: 'Těžká pěchota',
    lightInfantry: 'Lehká pěchota',
    ranged: 'Střelci',
    cavalry: 'Jízda',
    lightCavalry: 'Lehká jízda',
    elephant: 'Sloni',
  } satisfies Record<Archetype, string>,

  terrains: {
    plain: 'Rovina',
    forest: 'Les',
    hill: 'Kopec',
    mountain: 'Hory',
    marsh: 'Bažina',
    ford: 'Brod',
    bridge: 'Most',
    road: 'Cesta',
    river: 'Řeka',
    sea: 'Moře',
    camp: 'Tábor',
  } satisfies Record<TerrainId, string>,

  abilities: {
    pilum: {
      name: 'Pilum',
      description: 'Vrh oštěpů před prvním útokem: jednorázový bonus k útoku.',
    },
    lineRelief: {
      name: 'Střídání linie',
      description: 'Vymění si místo se sousední vlastní jednotkou.',
    },
    shieldWall: {
      name: 'Štítová hradba',
      description: 'Vyšší obrana proti jízdě.',
    },
    furiousCharge: {
      name: 'Zuřivý útok',
      description: 'Bonus k útokům, které jednotka sama zahájí.',
    },
    hitAndRun: {
      name: 'Udeř a ustup',
      description: 'Útočí bez protiútoku a po útoku může odjet.',
    },
    fear: {
      name: 'Strach',
      description: 'Oslabuje sousední jízdu a otřásá tím, koho zasáhne.',
    },
    rampage: {
      name: 'Běsnění',
      description: 'Když se dá na útěk, zaútočí na náhodnou sousední jednotku, i vlastní.',
    },
  } satisfies Record<AbilityId, AbilityText>,

  moraleStates: {
    steady: 'pevná',
    shaken: 'otřesená',
    routing: 'na útěku',
  } satisfies Record<MoraleState, string>,

  victoryReasons: {
    campCaptured: 'dobyl tábor soupeře',
    armyBroken: 'armáda soupeře je zlomena',
  } satisfies Record<VictoryReason, string>,

  saveProblems: {
    unreadable: 'Tohle není uložená bitva hry Vermont.',
    otherVersion: 'Uložená bitva je z jiné verze hry a nejde načíst.',
    damaged: 'Uložená bitva je poškozená a nejde načíst.',
  } satisfies Record<SaveProblem, string>,

  rejections: {
    unknownCommand: 'Neznámý příkaz.',
    wrongPhase: 'To teď nejde.',
    battleEnded: 'Bitva už skončila.',
    unknownUnit: 'Taková jednotka neexistuje.',
    notYourUnit: 'To není tvoje jednotka.',
    unitNotOnField: 'Jednotka už není na bojišti.',
    unitRouting: 'Jednotka je na útěku a neposlouchá rozkazy.',
    invalidPath: 'Tudy cesta nevede.',
    impassable: 'Na tenhle terén jednotka nemůže.',
    hexOccupied: 'Hex je obsazený.',
    zoneOfControl: 'Jednotka musí zastavit vedle nepřítele.',
    notEnoughMovement: 'Jednotce nestačí body pohybu.',
    alreadyAttacked: 'Jednotka už v tomto tahu útočila.',
    invalidTarget: 'Na tenhle cíl to nejde.',
    engaged: 'Jednotka nemůže střílet, když vedle ní stojí nepřítel.',
    outOfRange: 'Cíl je mimo dostřel.',
    noLineOfSight: 'Na cíl není vidět.',
    abilityUnavailable: 'Schopnost teď nejde použít.',
    invalidHex: 'Takový hex na mapě není.',
    outsideDeploymentZone: 'Hex je mimo tvoji zónu rozestavení.',
    unitsNotDeployed: 'Nejdřív rozestav všechny jednotky.',
  } satisfies Record<RejectionCode, string>,
} as const;

export type UiKey = keyof typeof cs.ui;
export type PluralKey = keyof typeof cs.plurals;
