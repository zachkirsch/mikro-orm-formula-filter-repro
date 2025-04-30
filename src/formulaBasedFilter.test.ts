import {
  Entity,
  Formula,
  ManyToOne,
  MikroORM,
  Opt,
  PrimaryKey,
  Property,
  Ref,
} from "@mikro-orm/sqlite";

@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Property()
  firstName!: string;

  @Property()
  lastName!: string;

  @Formula((alias) => `(CONCAT(${alias}.first_name, ' ',${alias}.last_name))`)
  name!: Opt<string>;
}

@Entity()
class Pet {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @ManyToOne(() => User, { nullable: true })
  owner!: Opt<Ref<User>> | null;
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [User, Pet],
    debug: ["query", "query-params"],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

// this passes
test("name formula works", async () => {
  orm.em.create(User, { firstName: "John", lastName: "Smith" });
  await orm.em.flush();
  orm.em.clear();

  const user = await orm.em.findOneOrFail(User, { firstName: "John" });
  expect(user.name).toBe("John Smith");

  await orm.em.getConnection().execute("DELETE FROM user");
});

// this passes
test("formula-based filter works when selecting directly from table", async () => {
  const em = orm.em.fork();
  em.addFilter("name is Jane Smith", { name: "Jane Smith" }, [User]);

  em.create(User, { firstName: "John", lastName: "Smith" });
  em.create(User, { firstName: "Jane", lastName: "Smith" });
  await em.flush();
  em.clear();

  const users = await em.findAll(User);
  expect(users.length).toBe(1);
  expect(users[0].name).toBe("Jane Smith");

  await em.getConnection().execute("DELETE FROM user");
});

/**
 * THIS FAILS!
 * 
 * Generated SQL:
 * 
    SELECT
    	`p0`.*,
    	`o1`.`id` AS `o1__id`,
    	`o1`.`first_name` AS `o1__first_name`,
    	`o1`.`last_name` AS `o1__last_name`,
    	(concat(`o1`.first_name, ' ', `o1`.last_name)) AS `o1__name`
    FROM
    	`pet` AS `p0`
    	LEFT JOIN `user` AS `o1` ON `p0`.`owner_id` = `o1`.`id`
    		AND (concat(`o1`.first_name, ' ', `o1`.last_name)) AS `name` = 'Jane Smith'
                                                           ^
                       SQLITE_ERROR: near "as": syntax error
    
 * The query works fine if AS `name` is removed.
 */
test("formula-based filter works via populate", async () => {
  const em = orm.em.fork();
  em.addFilter("name is Jane Smith", { name: "Jane Smith" }, [User]);

  em.create(Pet, {
    name: "Spot",
    owner: { firstName: "John", lastName: "Smith" },
  });
  em.create(Pet, {
    name: "Buck",
    owner: { firstName: "Jane", lastName: "Smith" },
  });

  await em.flush();
  em.clear();

  const pets = await em.findAll(Pet, {
    populate: ["owner"],
  });

  expect(pets.length).toBe(2);

  const spot = pets.find((p) => p.name === "Spot");
  expect(spot?.owner ?? null).toBeNull(); // should be filtered out

  const buck = pets.find((p) => p.name === "Buck");
  expect(buck?.owner?.$.name).toBe("Jane Smith");

  await em.getConnection().execute("DELETE FROM user");
  await em.getConnection().execute("DELETE FROM pet");
});
