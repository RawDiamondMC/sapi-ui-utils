import { Container, ItemStack, Player, RawMessage } from "@minecraft/server";
// noinspection ES6UnusedImports
import {
  ActionFormData,
  ActionFormResponse,
  MessageFormData,
  MessageFormResponse,
  ModalFormData,
} from "@minecraft/server-ui";
import * as sapi from "sapi-utils";

const quests: Map<string, any> = new Map<string, any>();

function getByCategory(category: string): Map<string, any> {
  const splitCategory: string[] = category.split(".");
  let currentCategory: Map<string, any> = quests;
  splitCategory.forEach((eachCategory: string) => {
    if (eachCategory === "") throw new Error("Category cannot be empty!");
    if (!currentCategory.has(eachCategory)) {
      const newMap: Map<string, any> = new Map<string, any>();
      currentCategory.set(eachCategory, newMap);
    }
    const current = currentCategory.get(eachCategory);
    if (!(current instanceof Map)) {
      throw new Error(`Expect ${eachCategory} to be a category, but got Quest!`);
    }
    currentCategory = current;
  });
  return currentCategory;
}

function getCategoryInfo(categoryMap: Map<string, any>, categoryName: string): CategoryInfo {
  if (!categoryMap.has("")) categoryMap.set("", CategoryInfo.getDefault(categoryName));
  return categoryMap.get("");
}

function getCategory(category: string): {
  map: Map<string, any>;
  info: CategoryInfo;
} {
  const map: Map<string, any> = getByCategory(category);
  return {
    map: map,
    info: getCategoryInfo(map, category[category.length - 1]),
  };
}

/**
 * Set the info of a category.
 * @param info
 * @param category
 */
export function setCategoryInfo(info: CategoryInfo, category: string): void {
  const map: Map<string, any> = getCategory(category).map;
  map.set("", info);
}

/**
 * Set the title of a category.
 * @param title
 * @param category
 */
export function setCategoryTitle(title: RawMessage, category: string): void {
  const info: CategoryInfo = getCategory(category).info;
  info.title = title;
}

/**
 * Set the body of a category.
 * @param body
 * @param category
 */
export function setCategoryBody(body: RawMessage, category: string): void {
  const info: CategoryInfo = getCategory(category).info;
  info.body = body;
}

export abstract class AbstractQuest {
  /**
   * The id of the Quest.
   *
   * Quests with the same id will be treated as the same quest.
   */
  readonly id: string;
  /**
   * The title the Quest.
   */
  // @ts-ignore
  protected _title: (quest: AbstractQuest) => RawMessage;
  get title(): RawMessage {
    return this._title(this);
  }

  set title(body: RawMessage | ((quest: AbstractQuest) => RawMessage)) {
    if (typeof body === "function") {
      this._title = body;
      return;
    }
    this._title = () => {
      return body;
    };
  }

  /**
   * The body the Quest.
   */
  // @ts-ignore
  protected _body: (quest: AbstractQuest) => RawMessage;
  get body(): RawMessage {
    return this._body(this);
  }

  set body(body: RawMessage | ((quest: AbstractQuest) => RawMessage)) {
    if (typeof body === "function") {
      this._body = body;
      return;
    }
    this._body = () => {
      return body;
    };
  }

  /**
   * The condition to complete the quest.
   */
  completeCondition: QuestCondition;
  /**
   * The condition to display the quest.
   */
  displayCondition: QuestCondition;
  /**
   * It will be called when the Quest is completed by the player.
   */
  reward: QuestReward;
  /**
   * The icon of the Quest.
   *
   * It should be the path from the root of the resource pack.
   * @example texture/gui/example_pic
   */
  icon?: string;

  constructor(
    id: string,
    title: RawMessage | ((quest: AbstractQuest) => RawMessage),
    body: RawMessage | ((quest: AbstractQuest) => RawMessage),
    completeCondition: QuestCondition,
    displayCondition: QuestCondition,
    reward: QuestReward,
    icon?: string,
  ) {
    this.id = id;
    this.title = title;
    this.body = body;
    this.completeCondition = completeCondition;
    this.displayCondition = displayCondition;
    this.reward = reward;
    this.icon = icon;
  }

  addToCategory(category: string): void {
    const categoryMap: Map<string, any> = getCategory(category).map;
    if (categoryMap.has(this.id)) throw new Error();
    categoryMap.set(this.id, this);
  }

  applyCondition(player: Player): void {
    player.addExperience(-(this.completeCondition.playerXpPoint ?? 0));
    player.addLevels(-(this.completeCondition.playerXpLevel ?? 0));
    this.completeCondition.item?.forEach((itemData: ItemData) => {
      sapi.removeItemInContainer(
        <Container>player.getComponent("minecraft:inventory")?.container,
        itemData.item.type.id,
        itemData.item.amount,
      );
    });
    this.completeCondition.custom?.(player, true);
  }

  /**
   * Return if this quest can be completed.
   * Return undefined when it can be completed.
   * @param player
   */
  canComplete(player: Player): undefined | RawMessage {
    return checkCondition(this.completeCondition, player);
  }

  /**
   * Return if this quest can be displayed in book.
   * @param player
   */
  canDisplay(player: Player): undefined | RawMessage {
    return checkCondition(this.displayCondition, player);
  }

  complete(player: Player): void {
    player.addTag(`${sapi.getModId()}:${this.id}`);
    player.sendMessage({
      translate: "sapi-utils.quest_finished",
      with: { rawtext: [this.title] },
    });
    player.addLevels(this.reward.playerXpLevel ?? 0);
    player.addExperience(this.reward.playerXpPoint ?? 0);
    const itemReward: ItemData[] = this.reward.item ?? [];
    itemReward.forEach((itemData: ItemData) => {
      player.getComponent("minecraft:inventory")?.container?.addItem(itemData.item);
    });
    this.reward.custom?.(player);
    player.playSound("random.levelup");
    if (this.reward.message) player.sendMessage(this.reward.message);
  }

  /**
   * Display the Quest to a player.
   * @param player
   * @param book
   * @param category the current category.
   */
  abstract display(player: Player, book: Book, category: string): void;

  /**
   * Check if a player has completed this quest.
   * @param player
   */
  isCompleted(player: Player): boolean {
    return player.hasTag(`${sapi.getModId()}:${this.id}`);
  }

  /**
   * Get the type of this.
   */
  getType(): QuestTypes {
    if (this instanceof Quest) return QuestTypes.QUEST;
    if (this instanceof Article) return QuestTypes.ARTICLE;
    return QuestTypes.UNKNOWN;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}

/**
 * Create a Quest.
 */
export class Quest extends AbstractQuest {
  private get form(): MessageFormData {
    return new MessageFormData()
      .title(this.title)
      .body(this.body)
      .button1({ translate: "gui.back" })
      .button2({ translate: "sapi-utils.quest.check" });
  }

  display(player: Player, book: Book, category: string): void {
    if (this.isCompleted(player)) {
      new ActionFormData()
        .title(this.title)
        .body(this.body)
        .show(player)
        .then((response: ActionFormResponse) => {
          if (response.selection) {
            book.displayCategory(player, category);
          }
        });
      return;
    }
    this.form.show(player).then((response: MessageFormResponse) => {
      if (!(!response.canceled && response.selection)) {
        return;
      }
      if (response.selection === 1) {
        const result: RawMessage | undefined = this.canComplete(player);
        if (result) {
          new ActionFormData()
            .title(this.title)
            .body(result)
            .button({ translate: "gui.ok" })
            .show(player)
            .then(() => {
              this.display(player, book, category);
            });
          return;
        }
        this.applyCondition(player);
        this.complete(player);
        return;
      }
      book.displayCategory(player, category);
    });
  }

  /**
   * Get the type of this.
   */
  getType(): QuestTypes {
    return QuestTypes.QUEST;
  }
}

/**
 * Create an Article (or message).
 *
 * The difference between `Quest` and `Article` is that `Article` will try to complete when user saw the article,
 * Quest will try when user click `Submit`.
 */
export class Article extends AbstractQuest {
  private get form() {
    return new ActionFormData().title(this.title).body(this.body).button({ translate: "gui.ok" });
  }

  display(player: Player, book: Book, category: string): void {
    if (this.isCompleted(player)) {
      this.form.show(player).then((response: ActionFormResponse) => {
        if (response.selection) {
          book.displayCategory(player, category);
        }
      });
      return;
    }
    this.form.show(player).then((response: MessageFormResponse) => {
      const result: RawMessage | undefined = this.canComplete(player);
      if (!result) {
        this.complete(player);
      }
      if (!(!response.canceled && response.selection)) {
        return;
      }
      if (response.selection === 1) {
        const result: RawMessage | undefined = this.canComplete(player);
        if (result) {
          this.form
            .body(result)
            .show(player)
            .then(() => {
              this.display(player, book, category);
            });
          return;
        }
        this.applyCondition(player);
        this.complete(player);
        return;
      }
      book.displayCategory(player, category);
    });
  }

  /**
   * Get the type of this.
   */
  getType(): QuestTypes {
    return QuestTypes.ARTICLE;
  }
}

export class Book {
  /**
   * The root category that this book will display.
   */
  root: string;

  /**
   * Get the title of the root category
   */
  get title(): RawMessage {
    return this.info.title;
  }

  /**
   * Set the title of the root category
   */
  set title(title: RawMessage) {
    setCategoryTitle(title, this.root);
  }

  /**
   * Get the body of the root category
   */
  get body(): RawMessage {
    return this.info.body;
  }

  /**
   * Set the body of the root category
   */
  set body(body: RawMessage) {
    setCategoryBody(body, this.root);
  }

  /**
   * Get the info of the root category
   */
  get info(): CategoryInfo {
    return getCategory(this.root).info;
  }

  /**
   * Set the info of the root category
   */
  set info(info: CategoryInfo) {
    setCategoryInfo(info, this.root);
  }

  /**
   * Get the map of the root category
   */
  get map(): Map<string, any> {
    return getCategory(this.root).map;
  }

  private getForm(): ActionFormData {
    return new ActionFormData().title(this.title).body(this.body);
  }

  constructor(category: string) {
    this.root = category;
  }

  /**
   * Display the book to the player.
   */
  display(player: Player): void {
    this.displayCategory(player, this.root);
  }

  /**
   * Display specific category to player.
   * @param player
   * @param category
   */
  displayCategory(player: Player, category: string): void {
    const map: Map<string, any> = this.map;
    const form: ActionFormData = this.getForm();
    const actions: ((player: Player, category: string) => void)[] = [];
    if (category !== this.root) {
      form.button({ translate: "gui.back" });
      actions.push((player: Player, category: string) => {
        const split: string[] = category.split(".");
        split.pop();
        this.displayCategory(player, split.join("."));
      });
    }
    map.forEach((value: any, key: string) => {
      if (value instanceof Map) {
        form.button(getCategoryInfo(map, key).title);
        actions.push((player: Player, category: string) => {
          this.displayCategory(player, `${category}.${key}`);
        });
      } else if (value instanceof AbstractQuest) {
        if (value.canDisplay(player)) {
          form.button(
            {
              rawtext: [
                { text: "§a" },
                value.isCompleted(player) ? { translate: "sapi-utils.quest.finished" } : {},
                { text: "§r" },
                value.title,
              ],
            },
            value.icon,
          );
          actions.push((player: Player, category: string) => {
            value.display(player, this, category);
          });
        }
      }
    });
    if (category !== this.root) {
      form.button({ translate: "gui.back" });
      actions.push((player: Player, category: string) => {
        const split: string[] = category.split(".");
        split.pop();
        this.displayCategory(player, split.join("."));
      });
    }
    form.show(player).then((response: ActionFormResponse) => {
      if (!response.canceled && response.selection) {
        actions[response.selection](player, category);
      }
    });
  }
}

/**
 * The type of the quest.
 */
export enum QuestTypes {
  ARTICLE = "article",
  QUEST = "quest",
  UNKNOWN = "unknown",
}

export interface QuestCondition {
  /**
   * Match only typeId and min amount.
   */
  item?: ItemData[];
  /**
   * The specific level will be required to unlock the quest.
   */
  playerXpLevel?: number;
  /**
   * The specific point will be required to unlock the quest.
   */
  playerXpPoint?: number;
  /**
   * The quests which should be completed.
   */
  quests?: AbstractQuest[];
  /**
   * Your custom function to check condition.
   *
   * the string (or RawMessage) will be displayed to the player as the quest can not be completed.
   *
   * Return undefined if the quest can be completed.
   *
   * You shouldn't remove anything or add anything if isCompleting is false.
   */
  custom?: (player: Player, isCompleting: boolean) => RawMessage | undefined;
}

export interface QuestReward {
  /**
   * Player will get these items when the quest is finished.
   */
  item?: ItemData[];
  /**
   * The specific level will be given to the player.
   */
  playerXpLevel?: number;
  /**
   * The specific point will be given to the player.
   */
  playerXpPoint?: number;
  /**
   * The message which will be sent to the player.
   */
  message?: RawMessage;
  /**
   * Your custom function give reward.
   */
  custom?: (player: Player) => void;
}

/**
 * Present the data of the item stack.
 */
export interface ItemData {
  /**
   * The name of the item. Amount will be automatically got from the ItemStack.
   */
  name: RawMessage;
  /**
   * The item.
   */
  item: ItemStack;
}

/**
 * Present the info of the category
 */
export class CategoryInfo {
  /**
   * The title of the category.
   */
  title: RawMessage;
  /**
   * The body of the category.
   */
  body: RawMessage;

  private constructor(title: RawMessage, body: RawMessage) {
    this.title = title;
    this.body = body;
  }

  /**
   * Get the default value of the CategoryInfo
   * @param categoryName the current category (without dots)
   */
  static getDefault(categoryName: string): CategoryInfo {
    return new CategoryInfo(
      { translate: `category.${sapi.getModId()}.${categoryName}.title` },
      {
        translate: `category.${sapi.getModId()}.${categoryName}.body`,
        with: ["\n"],
      },
    );
  }
}

function checkCondition(condition: QuestCondition, player: Player) {
  const message: RawMessage = { rawtext: [] };
  let itemCondition: ItemData[] = condition.item ?? [];
  for (const itemData of itemCondition) {
    const container: Container = <Container>player.getComponent("minecraft:inventory")?.container;
    if (sapi.item.getItemAmountInContainer(container, itemData.item.typeId) < itemData.item.amount) {
      message.rawtext?.push({
        translate: "sapi-utils.quest.condition.not_satisfied.item",
        // You need %%1 more %%2!
        with: {
          rawtext: [
            {
              text: (
                sapi.item.getItemAmountInContainer(container, itemData.item.typeId) - itemData.item.amount
              ).toString(),
            },
            itemData.name,
          ],
        },
      });
      message.rawtext?.push({ text: "\n" });
    }
  }
  message.rawtext?.push({ text: "\n" });
  if (condition.quests) {
    condition.quests.forEach((quest: AbstractQuest) => {
      if (!quest.isCompleted(player)) {
        message.rawtext?.push({
          rawtext: [
            {
              translate: "sapi-utils.quest.condition.not_satisfied.quest",
              with: { rawtext: [quest.title] },
            }, // %%1 is not completed!
            {
              text: "\n",
            },
          ],
        });
      }
    });
  }
  if (condition.playerXpLevel && player.level < condition.playerXpLevel) {
    message.rawtext?.push({
      rawtext: [
        {
          translate: "sapi-utils.quest.condition.not_satisfied.level",
          with: [(player.level - condition.playerXpLevel).toString()],
        }, // You need %%1 more level(s)!
        {
          text: "\n",
        },
      ],
    });
  }
  if (condition.playerXpPoint && sapi.player.getAllExp(player) < condition.playerXpPoint) {
    message.rawtext?.push({
      rawtext: [
        {
          translate: "sapi-utils.quest.condition.not_satisfied.experience",
          with: [(sapi.player.getAllExp(player) - condition.playerXpPoint).toString()],
        }, // You need %%1 more experience!
        {
          text: "\n",
        },
      ],
    });
  }
  const custom: undefined | RawMessage = condition.custom?.(player, false);
  if (custom !== undefined) {
    message.rawtext?.push({
      rawtext: [
        custom,
        {
          text: "\n",
        },
      ],
    });
  }
  return <number>message.rawtext?.length > 0 ? message : undefined;
}

/**
 * Generate Quest description by condition and reward.
 *
 * `custom` and `message` is not supported.
 */
export function generateDescriptionByCondition(
  body: RawMessage,
  condition: QuestCondition,
  reward: QuestReward,
): RawMessage {
  const conditionText: RawMessage = {};
  condition.item?.forEach((itemData: ItemData) => {
    conditionText.rawtext?.push({
      translate: "sapi-utils.quest.condition.item",
      with: { rawtext: [{ text: itemData.item.amount.toString() }, itemData.name] },
    });
    conditionText.rawtext?.push({ text: "; " });
  });
  condition.quests?.forEach((quest: AbstractQuest) => {
    conditionText.rawtext?.push({
      translate: "sapi-utils.quest.condition.quest",
      with: { rawtext: [quest.title] },
    });
    conditionText.rawtext?.push({ text: "; " });
  });
  if (condition.playerXpLevel) {
    conditionText.rawtext?.push({
      translate: "sapi-utils.quest.condition.level",
      with: [condition.playerXpLevel.toString()],
    });
    conditionText.rawtext?.push({ text: "; " });
  }
  if (condition.playerXpPoint) {
    conditionText.rawtext?.push({
      translate: "sapi-utils.quest.condition.experience",
      with: [condition.playerXpPoint.toString()],
    });
    conditionText.rawtext?.push({ text: "; " });
  }
  if (<number>conditionText.rawtext?.length === 0) {
    conditionText.rawtext?.push({ translate: "sapi-utils.quest.condition.none" });
  }

  const rewardText: RawMessage = {};
  reward.item?.forEach((itemData: ItemData) => {
    rewardText.rawtext?.push({
      translate: "sapi-utils.quest.reward.item",
      with: { rawtext: [{ text: itemData.item.amount.toString() }, itemData.name] },
    });
    rewardText.rawtext?.push({ text: "; " });
  });
  if (reward.playerXpLevel) {
    rewardText.rawtext?.push({
      translate: "sapi-utils.quest.reward.level",
      with: [reward.playerXpLevel.toString()],
    });
    rewardText.rawtext?.push({ text: "; " });
  }
  if (reward.playerXpPoint) {
    rewardText.rawtext?.push({
      translate: "sapi-utils.quest.reward.experience",
      with: [reward.playerXpPoint.toString()],
    });
    rewardText.rawtext?.push({ text: "; " });
  }
  if (<number>rewardText.rawtext?.length === 0) {
    rewardText.rawtext?.push({ translate: "sapi-utils.quest.reward.none" });
  }
  return {
    rawtext: [
      body,
      { text: "\n\n" },
      { translate: "sapi-utils.quest.condition" },
      conditionText,
      { text: "\n" },
      { translate: "sapi-utils.quest.reward" },
      rewardText,
    ],
  };
}
