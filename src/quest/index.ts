import {
  Container,
  ItemStack,
  Player,
  RawMessage,
  world,
} from "@minecraft/server";
// noinspection ES6UnusedImports
import {
  ActionFormData,
  ActionFormResponse,
  FormCancelationReason,
  MessageFormData,
  MessageFormResponse,
  ModalFormData,
} from "@minecraft/server-ui";
import * as sapi from "sapi-utils";
export * from "./utils.js";

let tagNameSpace: string = "sapi-q";

export class QuestBook {
  /**
   * The unique id of the QuestBook.
   */
  readonly id: string;
  /**
   * The title the QuestBook.
   */
  title: string | RawMessage;
  protected _body:
    | string
    | RawMessage
    | ((book: QuestBook) => string | RawMessage);
  /**
   * The body the QuestBook.
   */
  get body(): string | RawMessage {
    return typeof this._body === "function" ? this._body(this) : this._body;
  }
  /**
   * The body the QuestBook.
   */
  set body(
    body: string | RawMessage | ((book: QuestBook) => string | RawMessage),
  ) {
    this._body = body;
  }
  private readonly quests: Quest[];
  private get form() {
    return new ActionFormData().title(this.title).body(this.body);
  }
  constructor(
    id: string,
    title: string | RawMessage,
    body: string | RawMessage | ((book: QuestBook) => string | RawMessage),
    quests: Quest[],
  ) {
    this.id = id;
    this.title = title;
    this._body = body;
    this.quests = quests;
  }
  /**
   * Display the book to the player.
   */
  display(player: Player): void {
    this.quests.forEach((quest: Quest) => {
      if (quest.canUnlock(player))
        this.form.button(
          quest.title + (quest.isCompleted(player) ? " §2✔" : ""),
          quest.icon,
        );
    });
    this.form.show(player).then((response: ActionFormResponse) => {
      if (response.canceled || response.selection === undefined) {
        return;
      }
      const quest: Quest = this.quests[response.selection];
      quest.display(player, this);
    });
  }
  /**
   * Add a quest.
   * @param quest
   * @param message optional information will be sent to world.
   */
  addQuest(quest: Quest, message?: string | RawMessage): void {
    this.quests.push(quest);
    if (typeof message === "string") {
      world.sendMessage({ text: message });
      return;
    }
    if (message) {
      world.sendMessage(message);
      return;
    }
  }
  /**
   * Get the quest by id.
   * @param id
   */
  getQuest(id: string): Quest | undefined {
    return this.quests.find((quest: Quest) => quest.id === id);
  }
  /**
   * get all quests.
   */
  getQuests(): Quest[] {
    return this.quests;
  }
}

/**
 * Create a Quest (or Message).
 */
export class Quest {
  /**
   * The unique id of the Quest.
   */
  readonly id: string;
  /**
   * The title the Quest.
   */
  title: string | RawMessage;
  protected _body:
    | string
    | RawMessage
    | ((quest: Quest) => string | RawMessage);
  /**
   * The body the Quest.
   */
  get body(): string | RawMessage {
    return typeof this._body === "function" ? this._body(this) : this._body;
  }
  /**
   * The body the Quest.
   */
  set body(
    body: string | RawMessage | ((quest: Quest) => string | RawMessage),
  ) {
    this._body = body;
  }
  /**
   * The type the Quest.
   */
  type: QuestTypes;
  /**
   * The condition to complete the quest.
   * It's not available when type is Message
   */
  completeCondition: QuestCondition;
  /**
   * The condition to unlock the quest / message.
   */
  unlockCondition: QuestCondition;
  /**
   * It will be called when the Quest is completed by the player.
   */
  award?: QuestAward;
  /**
   * The icon of the Quest.
   * It should be the path from the root of the resource pack.
   * @example texture/gui/example_pic
   */
  icon?: string;
  constructor(
    id: string,
    title: string | RawMessage,
    body: string | RawMessage | ((quest: Quest) => string | RawMessage),
    type: QuestTypes,
    completeCondition: QuestCondition,
    unlockCondition: QuestCondition,
    award?: QuestAward,
    icon?: string,
  ) {
    this.id = id;
    this.title = title;
    this._body = body;
    this.type = type;
    this.icon = icon;
    this.completeCondition = completeCondition;
    this.unlockCondition = unlockCondition;
    this.award = award;
  }
  private get form() {
    return new MessageFormData()
      .title(this.title)
      .body(this.body)
      .button1({ translate: "gui.done" })
      .button2({ translate: "gui.back" });
  }
  /**
   * Return if this quest can be completed.
   * @param player
   */
  canComplete(player: Player): true | RawMessage {
    return checkCondition(this.completeCondition, player);
  }
  /**
   * Return if this quest can be displayed.
   * @param player
   */
  canUnlock(player: Player): true | RawMessage {
    return checkCondition(this.unlockCondition, player);
  }
  complete(player: Player): void {
    player.addTag(`${tagNameSpace}:${this.id}`);
    player.addLevels(this.award?.playerXpLevel ?? 0);
    player.addExperience(this.award?.playerXpPoint ?? 0);
    let itemAward: ItemStack | ItemStack[] = this.award?.item ?? [];
    if (!Array.isArray(itemAward)) itemAward = [itemAward];
    itemAward.forEach((item: ItemStack) => {
      player.getComponent("minecraft:inventory")?.container?.addItem(item);
    });
    this.award?.custom?.(player);
    player.playSound("random.levelup");
    player.sendMessage({
      translate: "sapi-utils.quest_finished",
      with: typeof this.title === "string" ? [this.title] : this.title,
    });
  }
  /**
   * Display the Quest to a player.
   * @param player
   * @param book if specific, the book will be opened after canceled.
   */
  display(player: Player, book?: QuestBook): void {
    this.form.show(player).then((response: MessageFormResponse) => {
      if (
        response.canceled &&
        response.cancelationReason === FormCancelationReason.UserBusy
      ) {
        book?.display(player);
        return;
      }
      if (this.isMessage()) {
        this.complete(player);
      }
      if (
        response.canceled ||
        response.selection === undefined ||
        response.selection === 1
      ) {
        book?.display(player);
        return;
      }
      const canComplete = this.canComplete(player);
      if (canComplete === true) {
        this.complete(player);
        return;
      }
      new ActionFormData()
        .title(this.title)
        .body(this.body)
        .button({ translate: "gui.done" })
        .show(player)
        .then(() => {
          this.display(player);
        });
    });
  }
  /**
   * Check if a player has completed this quest.
   * @param player
   */
  isCompleted(player: Player): boolean {
    return player.hasTag(`${tagNameSpace}:${this.id}`);
  }
  /**
   * Check if the type is INFO
   */
  isMessage(): boolean {
    return this.type === QuestTypes.INFO;
  }
}

/**
 * The type of the quest.
 */
export enum QuestTypes {
  INFO,
  QUEST,
}

export interface QuestCondition {
  /**
   * Match only typeId and min amount.
   */
  item?: ItemData[] | ItemData;
  /**
   * The specific level will be required to unlock the quest.
   */
  playerXpLevel?: number;
  /**
   * The specific point will be required to unlock the quest.
   */
  playerXpPoint?: number;
  /**
   * Your custom function to check condition.
   * the string (or RawMessage) will be displayed to the player as the quest can not be completed.
   * Return undefined if the quest can be completed.
   */
  custom?: (player: Player) => string | RawMessage | undefined;
}

export interface QuestAward {
  /**
   * Player will get these items when the quest is finished.
   */
  item?: ItemStack[] | ItemStack;
  /**
   * The specific level will be given to the player.
   */
  playerXpLevel?: number;
  /**
   * The specific point will be given to the player.
   */
  playerXpPoint?: number;
  /**
   * Your custom function give award.
   */
  custom?: (player: Player) => void;
}

export interface ItemData {
  name: string;
  item: ItemStack;
}

function checkCondition(condition: QuestCondition, player: Player) {
  let message: RawMessage = { rawtext: [] };
  let itemCondition: ItemData | ItemData[] = condition.item ?? [];
  if (!Array.isArray(itemCondition)) itemCondition = [itemCondition];
  for (const itemData of itemCondition) {
    const container: undefined | Container = player.getComponent(
      "minecraft:inventory",
    )?.container;
    if (!container) return { translate: "sapi-utils.unexpected_error" }; // An unexpected error occurred!
    if (
      sapi.item.getItemAmountInContainer(container, itemData.item.typeId) <
      itemData.item.amount
    ) {
      if (
        !message.rawtext?.some(
          (item: RawMessage) =>
            item.translate === "sapi-utils.condition.item_not_enough",
        )
      ) {
        message.rawtext?.push({
          rawtext: [
            {
              translate: "sapi-utils.condition.item_not_enough",
            }, // Following items are missing from your inventory:
            {
              text: "\n",
            },
          ],
        });
      }
      message.rawtext?.push({
        rawtext: [
          {
            translate: itemData.name,
          },
          {
            text: "*",
          },
          {
            text: (
              itemData.item.amount -
              sapi.item.getItemAmountInContainer(
                container,
                itemData.item.typeId,
              )
            ).toString(),
          },
          {
            text: "\n",
          },
        ],
      });
    }
  }
  if (condition.playerXpLevel && player.level < condition.playerXpLevel) {
    message.rawtext?.push({
      rawtext: [
        {
          translate: "sapi-utils.condition.level_not_enough",
          with: [player.level.toString()],
        }, // You need %%1 more level(s)!
        {
          text: "\n",
        },
      ],
    });
  }
  if (
    condition.playerXpPoint &&
    sapi.player.getAllExp(player) < condition.playerXpPoint
  ) {
    message.rawtext?.push({
      rawtext: [
        {
          translate: "sapi-utils.condition.experience_not_enough",
          with: [sapi.player.getAllExp(player).toString()],
        }, // You need %%1 more experience!
        {
          text: "\n",
        },
      ],
    });
  }
  let custom: undefined | string | RawMessage = condition.custom?.(player);
  if (custom !== undefined) {
    if (typeof custom === "string") {
      custom = { text: custom };
    }
    message.rawtext?.push({
      rawtext: [
        custom,
        {
          text: "\n",
        },
      ],
    });
  }
  return <number>message.rawtext?.length > 0 ? message : true;
}

/**
 * Set the namespace of the Quest Complete Tag
 * @param str the namespace
 */
export function setTagNameSpace(str: string) {
  tagNameSpace = str;
}
