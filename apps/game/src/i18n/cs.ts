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

    'menu.newBattle': 'Nová bitva',
    'menu.continue': 'Pokračovat v bitvě',
    'menu.settings': 'Nastavení',
    'menu.back': 'Zpět',
    'menu.mainMenu': 'Hlavní menu',
    'menu.restart': 'Hrát znovu',
    'menu.pause': 'Pauza',
    'menu.resume': 'Zpět do bitvy',
    'menu.shortcuts': 'Ovládání',

    'scenarios.title': 'Výběr scénáře',
    'scenarios.units': '{count} {units}',
    'scenarios.versus': 'proti',
    'scenarios.autoDeploy': 'Rozestavit obě armády automaticky',
    'scenarios.fog': 'Mlha války: každý vidí jen to, co jeho jednotky',
    'scenarios.start': 'Začít bitvu',

    'settings.title': 'Nastavení',
    'settings.confirmEndTurn': 'Potvrzovat konec tahu, když jednotky ještě mohou jednat',
    'settings.showLog': 'Zobrazovat log událostí',

    'hud.round': 'Kolo {turn}',
    'hud.deployment': 'Rozestavení',
    'hud.onTurn': 'na tahu',
    'hud.endTurn': 'Ukončit tah',
    'hud.undo': 'Vrátit',
    'hud.menu': 'Menu',
    'hud.ready': 'Může jednat: {count}',
    'hud.army.fighting': 'v boji {count} z {total}',
    'hud.army.routing': 'na útěku {count}',
    'hud.army.strength': 'Síla armády',
    'hud.confirmEndTurn': 'Některé jednotky ještě mohou jednat ({count}). Opravdu ukončit tah?',
    'hud.confirm': 'Ukončit tah',
    'hud.cancel': 'Zpět',

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
    'tip.damage': 'ztráty soupeře {min}–{max}',
    'tip.counter': 'protiútok {min}–{max}',
    'tip.noCounter': 'bez protiútoku',
    'tip.kind.melee': 'boj zblízka',
    'tip.kind.ranged': 'střelba',

    'log.title': 'Události',
    'log.empty': 'Zatím se nic nestalo.',
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
    'log.retreated': '{unit}: ustupuje před nepřítelem.',
    'log.rallied': '{unit}: znovu v boji.',
    'log.fled': '{unit}: opustila bojiště.',
    'log.battleEnded': '{side} vítězí: {reason}.',

    'victory.title': 'Vítězství: {side}',

    'keys.title': 'Ovládání',
    'keys.click': 'Klik: výběr jednotky, pohyb, útok',
    'keys.drag': 'Tažení myší: posun mapy, kolečko: zoom',
    'keys.rotate': 'Q / E: otočení mapy',
    'keys.pan': 'W A S D nebo šipky: posun mapy',
    'keys.endTurn': 'Enter: konec tahu, potvrzení rozestavení nebo převzetí počítače',
    'keys.undo': 'Backspace nebo Ctrl+Z: vrátit pohyb',
    'keys.next': 'Tab / Shift+Tab: další a předchozí jednotka, která může jednat',
    'keys.relief': 'R: střídání linie',
    'keys.log': 'L: zobrazit nebo skrýt log',
    'keys.escape': 'Esc: zrušit výběr, pak menu',
    'keys.help': 'H: tato nápověda',
  },

  plurals: {
    hexes: ['hex', 'hexy', 'hexů'],
    units: ['jednotka', 'jednotky', 'jednotek'],
  } satisfies Record<string, PluralForms>,

  /** By the id from the game data; an id missing here shows the name from the data. */
  factions: {
    rome: 'Řím',
    carthage: 'Kartágo',
  } as Readonly<Record<string, string>>,

  scenarios: {
    trebia: 'Trebia (218 př. n. l.)',
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
