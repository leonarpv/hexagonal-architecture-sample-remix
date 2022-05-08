import type { PrismaClient } from "@prisma/client";
import { Inject, Injectable } from "@nestjs/common";
import type { TodoListDto } from "shared";
import type { TodoListId } from "../domain/TodoList";
import { PRISMA } from "../keys";
import type { FetchTodoListQuery } from "./FetchTodoListQuery";
import type { OwnerId } from "../domain/OwnerId";

type TodoListRow = {
  id: string;
  title: string;
  createdAt: string;
  todosOrder: string[];
};

type TodoRow<Completion extends boolean> = {
  id: string;
  title: string;
  isComplete: Completion;
  createdAt: string;
};

@Injectable()
export class FetchTodoListPrismaQuery implements FetchTodoListQuery {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async run(todoListId: TodoListId, ownerId: OwnerId): Promise<TodoListDto> {
    const { todosOrder, ...todoList } = await this.fetchTodoList(
      todoListId,
      ownerId
    );
    const [doingTodos, completedTodos] = await Promise.all([
      this.fetchDoingTodos(todoListId, ownerId),
      this.fetchCompleteTodos(todoListId, ownerId),
    ]);

    if (!todoList)
      throw new Response(`Todo list "${todoListId}" was not found.`);

    return {
      ...todoList,
      doingTodos: this.sortTodos(doingTodos, todosOrder),
      completedTodos: this.sortTodos(completedTodos, todosOrder),
    };
  }

  private fetchTodoList(todoListId: TodoListId, ownerId: OwnerId) {
    return this.prisma.$queryRaw<TodoListRow[]>`
        SELECT TL.id, TL.title, TL."createdAt", TL."todosOrder"
        FROM "TodoList" TL
        WHERE TL.id = ${todoListId} AND TL."ownerId" = ${ownerId};
    `.then((rows) => rows[0]);
  }

  private fetchDoingTodos(todoListId: TodoListId, ownerId: OwnerId) {
    return this.prisma.$queryRaw<TodoRow<false>[]>`
        SELECT id, title, "isComplete", "createdAt" FROM "Todo"
        WHERE "isComplete" IS false AND "todoListId" = ${todoListId} AND "ownerId" = ${ownerId};
    `;
  }

  private fetchCompleteTodos(todoListId: TodoListId, ownerId: OwnerId) {
    return this.prisma.$queryRaw<TodoRow<true>[]>`
        SELECT id, title, "isComplete", "createdAt" FROM "Todo"
        WHERE "isComplete" IS true AND "todoListId" = ${todoListId} AND "ownerId" = ${ownerId};
    `;
  }

  private sortTodos<T extends boolean>(todos: TodoRow<T>[], order: string[]) {
    const position = (idToCheck: string) =>
      order.findIndex((id) => idToCheck === id) ?? 0;
    return todos.sort((t1, t2) => position(t1.id) - position(t2.id));
  }
}
