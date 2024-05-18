import {
  Quest,
  QuestAward,
  QuestBook,
  QuestCondition,
  QuestTypes,
} from "./index.js";
import { RawMessage } from "@minecraft/server";

export function createQuestBookFromArray(
  questData: QuestData[],
  book: QuestBookData,
): QuestBook {
  const quests: Quest[] = [];
  questData.forEach((data) => {
    quests.push(createQuest(data));
  });
  return new QuestBook(book.id, book.title, book.body, quests);
}

export function createQuest(data: QuestData) {
  return new Quest(
    data.id,
    data.title,
    data.body,
    data.type,
    data.completeCondition,
    data.unlockCondition,
    data.award,
    data.icon,
  );
}

export interface QuestData {
  id: string;
  title: string | RawMessage;
  body: string | RawMessage;
  type: QuestTypes;
  completeCondition: QuestCondition;
  unlockCondition: QuestCondition;
  award?: QuestAward;
  icon?: string;
}

export interface QuestBookData {
  id: string;
  title: string | RawMessage;
  body: string | RawMessage;
}
