import 'mongodb';

declare module 'mongodb' {
  export interface Db {
    collection<TSchema extends Document = any>(
      name: string,
      options?: any
    ): Collection<TSchema & { _id: string }>;
  }
}
