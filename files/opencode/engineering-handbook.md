# Engineering Handbook

*How much structure code deserves, and when that changes. For any language.*

Most advice about code structure comes as rules: keep functions small, don't
repeat yourself, separate your layers. Each rule is true somewhere. Applied
everywhere, they produce code that is tidy on the surface and exhausting to
follow: five files to understand one step, an interface with a single
implementation, a config option nobody ever changed.

This guide is about something else: **how to decide how much structure a piece
of code deserves, and when that answer changes.** It reads the same for a
team's shared codebase and for a weekend project, because every decision in it
comes from one place: what you, the person writing the code, know about the
problem and how it is growing.

The idea underneath everything:

> Simplicity is well-implemented complexity, not less capability.

Simple code is not code that does less. It is code whose shape matches the
problem, no more and no less, so that the complexity you see is the
complexity the problem actually has. Rich Hickey draws the same line between
*simple* (not entangled) and *easy* (familiar, close at hand): this guide is
about the first.

---

## 1. Structure is a cost you pay up front

Every file split, interface, base class, config knob and layer is an
investment. You pay for it immediately, in indirection and in things a reader
must hold in their head. It pays back only when the code grows in the
direction the structure anticipated.

Pay for structure the code already needs, and you get clarity. Pay for
structure the code might need, and you get a tax on every read, often for a
future that arrives in a different shape than you guessed.

So the question is never "is this good structure?" in the abstract. It is:
**does this code, as it is today, have enough complexity to earn this
structure?**

## 2. Decisions are sliders

Almost no design choice has a right answer. Most sit on a line between two
reasonable poles:

```text
               inline  <────>  abstracted
operations over data   <────>  polymorphic entities
             one file  <────>  many modules
               direct  <────>  layered
           hard-coded  <────>  configurable
           consistent  <────>  expressive
             explicit  <────>  implicit
    written to change  <────>  written to teach
              obvious  <────>  fast
```

Neither end is better. Each position is right for some code and wrong for
other code, and the same code can move along the line as it grows. What moves
the slider are **forces in the code itself**: how many cases exist, how
concepts relate, what keeps changing, what is expensive to undo.

The method is the same every time:

1. **Start at the cheapest position that works today.** Factor late: the
   right cut points only show up once the code exists.
2. **Name the forces that are actually present**, in the code as it is now.
   Imagined forces don't count.
3. **Know what would make you move.** If that signal shows up, move. Until
   then, stay.
4. **Weigh the cost of moving later.** If moving is cheap, stay low. If it is
   expensive, starting further along is justified. Picture the restructure
   you would do later; it is usually smaller than it feels. And staying low
   only works while the code is cheap to change: the tests and refactoring
   that keep it that way are not speculative structure.

The same method settles review disagreements: each side names the force it
sees and the signal that would move it. If that does not settle it, take the
cheaper position and write the trigger in the PR ("split this when a second
backend lands").

The cost of moving is the honest answer to "why ever build structure up front?".
Reversal cost is set by who depends on a decision, not by what kind of
decision it is. A data format written to disk, a database schema, a public
interface or a wire protocol are expensive because something outside your
control is built on them; a helper imported by five other teams is in the
same class. The test: would undoing it need a migration, a coordinated
release, or changes outside this repo? If so, think before the first line.
Check who imports it before calling a change cheap.
If not (how you split files, whether a helper exists, whether there is a
base class), the cheapest position wins, and the structure should follow the
code, not lead it.

## 3. Reading the code for signals

Structural decisions happen before the code is written. You carry a mental
model of the code, and when a new requirement appears (a ticket, an
inherited task, a need someone raised) you test it against that model, often
while writing the ticket. The question: is this an extension, a new part
plugged into a working machine, or does the machine need restructuring first?
Ask it at every meaningful change; the answer may be to grow the structure,
shrink it, or leave it alone.

The signals below are what you notice while building or refreshing that
model: "I'd have to touch four places", "this needs a flag to fit".

**Toward more structure:**

- **The same edit, in several places, again.** You changed one idea and had
  to touch four files to do it, and this is not the first time. Unless the
  copies change for different reasons (§4).
- **A second real case exists.** A case is real when a requirement for it
  exists: a ticket, a task, a need someone raised. "We might support Postgres
  someday" is imagined. Organisational forces count too: two teams editing
  the same code is a real reason to split it.
- **You can't hold a step in your head.** Understanding one part means
  remembering the internals of another: you open a second file to know what
  a call returns or assumes.
- **Changes leak.** Touching one area keeps breaking an unrelated one.
- **Concepts are smeared.** The properties of one logical thing are computed
  in five places instead of living together (see "what changes together" in
  §6).

**Toward less structure:**

- **An abstraction still has one implementation**, long after it was built
  "for flexibility".
- **Callers bend it.** A flag or optional parameter was added so a new caller
  "almost" fits:

  ```python
  def send_invoice(
      order: Order, *, skip_tax: bool = False, legacy_format: bool = False, dry_run: bool = False
  ) -> None:
      ...
  ```

  A parameter that carries a value is fine: `skip_tax` becomes `tax_rate`. A
  boolean that switches code paths, like `legacy_format`, is a second
  function hiding inside the first. Split it, and share what is truly common
  as a pure core. `dry_run` is an I/O decision, so it leaves too: pass a
  mailer that only prints.

  ```python
  def invoice_lines(order: Order, tax_rate: Decimal) -> list[Line]: ...

  def send_invoice(order: Order, tax_rate: Decimal, mailer: Mailer) -> None:
      mailer.send(render(invoice_lines(order, tax_rate)))

  def send_legacy_invoice(order: Order, tax_rate: Decimal, mailer: Mailer) -> None:
      mailer.send(render_legacy(invoice_lines(order, tax_rate)))
  ```
- **You read through it more than you use it.** Every time you debug, you
  step into the abstraction to see what it really does.
- **The structure describes a past problem.** The code was organised for a
  requirement that no longer exists.

Before removing structure that looks pointless, find out why it was added:
the tests, the history or the author usually say. If the reason is gone,
delete it; if it isn't, you just learned a requirement.

When the machine needs restructuring, make that its own step, often its own
line in the ticket:

> Make the change easy, then make the easy change. (Kent Beck)

Restructure first, with behaviour unchanged. Then add the feature on top of
the new shape. Two small steps you can verify beat one large step you can't.
Stop tidying when it costs more than the change it enables: when the
restructure diff outgrows the feature, or reaches modules the feature never
touches, ship the feature and ticket the rest.

Say a report reads orders from a CSV export, and now it must also read them
from an API. Rather than adding `if source == "api"` branches throughout:

```text
step 1 (no behaviour change)   move CSV parsing behind fetch_orders(path) -> list[Order]
step 2 (the feature)           add fetch_orders_from_api(url) -> list[Order]; main picks one
```

After step 1 the program does exactly what it did before, and step 2 touches
one function and one line of `main`.

## 4. The sliders

### Inline ↔ abstracted

The common advice is "duplicate before you abstract" (the Rule of Three).
It is a good guard against bad abstractions, but it measures the wrong thing.
The count of copies matters less than what the abstraction costs the reader.
Copies that merely exist are not a signal; the same edit repeated across them
is (§3).

**Abstract when it is plug and play.** These checks are for an abstraction
other code builds on: a shared function, class or module with several
callers. Naming a single step inside one file is the lighter rule in §5. An
abstraction earns its place when it lowers, or at least doesn't raise, what
a reader must hold in their head:

- **The name is enough.** You can call `load_config(path)` or `retry(fn)`
  without opening it.
- **It hides one decision**: a file format, a retry policy, a client. It has
  one reason to change.
- **Callers plug in without bending it**: none of the flags from §3.
- **The flow stays visible.** It abstracts a step, not the order of the steps.
- **It is cheap to undo.** Inlining it back is mechanical.
- **The hidden work is large next to the interface.** A wrapper that only
  passes its arguments through fails, even if it passes the other checks.

All of them should hold. Compare:

```python
# Abstracts a step: the pipeline is still readable
def main() -> None:
    config = load_config(CONFIG_PATH)
    orders = fetch_orders(config.source)
    orders = deduplicate(orders)
    write_report(orders, config.output)
```

```python
# Abstracts the order: the pipeline now lives in a registry
PIPELINE = Pipeline.from_yaml("steps.yml")

def main() -> None:
    PIPELINE.run(context=Context.from_env())
```

The second is shorter and says much less. To learn what the program does you
have to read the YAML, the `Pipeline` class and the `Context` class. That
trade is worth it only if pipelines really are user-defined data. For one
fixed pipeline it is pure cost.

Keep look-alikes apart when they change for different reasons. Two validators
with the same shape today, enforcing different business rules, will drift:

```python
class Invalid(ValueError): ...

@dataclass(frozen=True)
class User:
    name: str
    age: int

@dataclass(frozen=True)
class Address:
    name: str
    country: str

SHIPPABLE = {"CH", "DE", "US"}

def validate_signup(user: User) -> None:            # product rule: who may create an account
    if len(user.name) < 2:
        raise Invalid(f"name too short: {user.name!r}")
    if user.age < 16:
        raise Invalid(f"too young: {user.age}")

def validate_shipping(address: Address) -> None:    # carrier rule: what the courier accepts
    if len(address.name) < 2:
        raise Invalid(f"name too short: {address.name!r}")
    if address.country not in SHIPPABLE:
        raise Invalid(f"cannot ship to {address.country}")
```

A shared `validate_name_and_one_more_thing()` would save two lines, and the
first time the carrier demands a 35-character name limit it would need a
flag. Same shape, different reasons to change.

### Operations over data ↔ polymorphic entities

Take shapes. You can organise the logic by operation:

```python
Kind = Literal["rectangle", "triangle", "ellipse"]

@dataclass(frozen=True)
class Shape:
    kind: Kind
    width: float    # of the bounding box
    height: float

# area as a fraction of the bounding box
COEFFICIENT: dict[Kind, float] = {"rectangle": 1.0, "triangle": 0.5, "ellipse": pi / 4}

def area(shape: Shape) -> float:
    return COEFFICIENT[shape.kind] * shape.width * shape.height
```

or by entity:

```python
@dataclass(frozen=True)
class Box:
    left: float
    bottom: float
    right: float
    top: float

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...
    @abstractmethod
    def perimeter(self) -> float: ...
    @abstractmethod
    def bounds(self) -> Box: ...

@dataclass(frozen=True)
class Circle(Shape):
    radius: float

    def area(self) -> float:
        return pi * self.radius**2
    def perimeter(self) -> float:
        return 2 * pi * self.radius
    def bounds(self) -> Box:
        return Box(-self.radius, -self.radius, self.radius, self.radius)
```

With one or two operations that differ only in a number, the first version is
clearer: the whole idea fits on one screen, and it shows a pattern the class
hierarchy would hide. One `Shape` record is safe here because every kind has
the same fields (the bounding box), so no field can disagree with `kind`.
When fields differ per kind, use a union of records instead: still plain
data, with no illegal states (§5). The table is also faster: Casey Muratori
measured it about ten times faster than a class hierarchy in C++, which
matters only inside a hot loop.

But once a concept has **several parallel properties that belong together**
(area, perimeter, bounds, rendering, hit-testing), the entity earns its
place. All the logic about circles lives in `Circle`, callers only see the
`Shape` interface, and as long as you don't need to extend a shape you never
look inside it. That is a good abstraction: a whole concept gone from every
call site.

- *Toward operations:* few operations; kinds differ only by data; the logic
  is a pipeline of steps; the tool is declarative by nature.
- *Toward entities:* several properties tied to one concept; new kinds
  arrive more often than new operations; callers should only need the
  interface.
- *Start:* operations over plain data. Introduce the entity when the
  properties start to cluster around it.

Each side makes one kind of change cheap. A new kind is one class with
entities, but an edit to every table or `match` with operations; a new
operation is the reverse. Ask the history which axis has changed more. The
practical trigger to move: kinds start needing their own fields or their own
logic, not just their own numbers, and new kinds keep arriving.

A declarative tool shows the operations end at its best. Picture a machine
setup script that installs developer tools. A class per tool:

```python
class Tool(ABC):
    @abstractmethod
    def install(self) -> None: ...
    @abstractmethod
    def configure(self) -> None: ...

class Git(Tool):
    def install(self) -> None:
        brew_install("git")
    def configure(self) -> None:
        copy("gitconfig", "~/.gitconfig")

class Ripgrep(Tool):
    def install(self) -> None:
        brew_install("ripgrep")
    def configure(self) -> None:
        pass
```

Every tool is the same few operations with different values. The values are
the whole story, so make them data and write each operation once:

```python
@dataclass(frozen=True)
class ConfigFile:
    src: str
    dest: str

@dataclass(frozen=True)
class Tool:
    id: str
    packages: tuple[str, ...]
    config: tuple[ConfigFile, ...]

TOOLS: tuple[Tool, ...] = (
    Tool(id="git", packages=("git",), config=(ConfigFile("gitconfig", "~/.gitconfig"),)),
    Tool(id="ripgrep", packages=("ripgrep",), config=()),
)

def main() -> None:
    for tool in TOOLS:
        brew_install(*tool.packages)
        for file in tool.config:
            copy(file.src, file.dest)
```

`Tool` is no longer a base class with behaviour. It is a plain record, and
the two operations that every tool shared now live in one place.

Adding a tool is now one line of data and no new code. The day a tool needs
behaviour that no field can express, that is the signal to reconsider.

Moving that list out of the script into a data file is a separate decision,
and it has its own costs: a second language, a loader, and types that stop
at the file's edge until it is parsed back in.

It earns its place when:

- the data changes far more often than the logic;
- there are several sets of the same data (per machine, environment or
  customer) for one program;
- something other than the program reads or edits it;
- the data has grown big enough to bury the logic.

It does not when entries need callables, conditions or computed values: a
data file that grows templating is a worse programming language.

The types come back at the boundary. Parse the file into the same frozen
records once, where it is read, and every function after that sees a
`Tool`, never a dictionary:

```python
def load_tools(path: Path) -> tuple[Tool, ...]:
    return tuple(
        Tool(
            id=entry["id"],
            packages=strings(entry["packages"]),
            config=tuple(ConfigFile(**file) for file in entry["config"]),
        )
        for entry in json.loads(path.read_text())
    )

def strings(value: object) -> tuple[str, ...]:
    # tuple("git") would silently become ('g', 'i', 't')
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValueError(f"expected a list of strings: {value!r}")
    return tuple(value)
```

A missing key fails here, naming the key, instead of deep inside `main`.
`ConfigFile(**file)` checks keys, not value types; once the hand-written
checks outgrow a helper like `strings`, a schema library earns its place.

Once it does move, pick the format for how the data is written and read:

| Format | Fits |
| --- | --- |
| Environment variables | A few scalars that differ per environment. |
| TOML / INI | Flat, hand-edited settings. |
| YAML | Hand-edited, nested data with comments. |
| JSON | Data written and read by programs; interchange. |
| CSV | Tabular data, often edited in a spreadsheet. |
| SQLite or a database | Large, queried or concurrently written data. |

### One file ↔ many modules

Don't split a file because it is long. Split it when part of it owns a
concern you could use without knowing how it works: a file format, a
protocol, a client. Count entanglement, not files: modules that depend on
each other's internals, or assume something about each other ("this never
returns an empty list"), are one module spread across files, and splitting
them adds jumps without hiding anything. Three independent pieces are
simpler than two knotted ones, however neatly the two are filed.

A script starts as one file, read top to bottom:

```text
report.py          constants and types, then functions in run order, main last
```

When a concern appears that can stand behind its own interface, it moves out:

```text
report/
├── __main__.py    the plan: steps in order, one call each
├── orders.py      fetching and parsing orders (the source's format lives here)
└── render.py      turning rows into the output document
```

When the program grows several independent features, organise by feature
rather than by technical layer, because a change usually touches one feature
end to end:

```text
# by layer: every change touches every folder
app/
├── controllers/   billing.py, shipping.py
├── models/        billing.py, shipping.py
└── stores/        billing.py, shipping.py

# by feature: a change stays in one place
app/
├── billing/       api.py, model.py, store.py
└── shipping/      api.py, model.py, store.py
```

### Direct ↔ layered

Ports and adapters, hexagonal architecture and clean architecture all add a
boundary between your logic and the outside world. They pay off when that
boundary has real variety on the other side: two storage backends, an
external system you must fake to test anything. With one database and one
caller, they are ceremony.

You get most of the benefit for free by keeping I/O at the edges:

```text
read input, env, files  ──>  pure logic (no I/O, no clock)  ──>  write output, call APIs
```

The pure core is easy to test and to reason about. If a second backend ever
arrives, the edge is already where the adapter goes. This is Gary
Bernhardt's "functional core, imperative shell".

```python
@dataclass(frozen=True)
class Invoice:
    due: date
    paid: bool

# core: plain values in, plain values out
def overdue(invoices: list[Invoice], today: date) -> list[Invoice]:
    return [i for i in invoices if i.due < today and not i.paid]

# shell: all the I/O, in one place
def send_reminders(db: Database, mailer: Mailer, today: date) -> None:
    for invoice in overdue(db.fetch_invoices(), today):
        mailer.send_reminder(invoice)

def main() -> None:
    db = Database(os.environ["DATABASE_URL"])
    mailer = Mailer(os.environ["SMTP_HOST"])
    send_reminders(db, mailer, date.today())
```

`overdue` is tested with a list and a date, no database or mocks. Passing a
dependency as a parameter is the cheap form of a port (the fake in §5 relies
on it); the ports and adapters folders are the ceremony. Compare the layered
version you would build "just in case":

```text
domain/ports/invoice_repository.py     interface with one method
domain/ports/notifier.py               interface with one method
adapters/postgres_invoice_repository.py
adapters/smtp_notifier.py
application/send_reminders_use_case.py
```

Five files for one database and one mailer. If a second database arrives,
the one-function shell above becomes the adapter in minutes.

When the core's decision depends on I/O results (fetch, decide, fetch
again), the core returns a value describing the next action and the shell
performs it, e.g. `next_step(state) -> Fetch | Retry | Done`. Stop when the
core collapses to a single `if`: then the shell can just make the decision.

### Hard-coded ↔ configurable

A value that never changes is a constant (where it lives is in §5). It
becomes configuration when it really differs between environments,
machines or uses, and changing it should not need a code change. Every knob
is another thing that has to be documented, validated and tested. Add it on
the day the second value exists.

```python
# start: a constant at the top of the file that uses it
RETRY_ATTEMPTS = 3

# later, when staging really needs a different value: read once, pass down
def main() -> None:
    retry_attempts = int(os.environ["RETRY_ATTEMPTS"])
    sync_orders(retry_attempts)
```

### Consistent ↔ expressive

In existing code, follow the patterns already there, even when you know a
cleaner one. A better pattern used in one corner is one more pattern to
learn. If the existing pattern is truly wrong for the problem, change it
everywhere as its own step, or migrate gradually with a written target and a
tracked count of remaining uses that goes to zero. Otherwise not at all.

If every module in a codebase returns errors as `(result, error)` tuples,
the one module that raises exceptions forces every caller to handle both.
The cleaner style, applied in one place, made the whole codebase harder.

### Explicit ↔ implicit

Decorators that register handlers, metaclasses, monkey-patching, plugins
discovered by import side effect: each removes a line from the call site and
moves it somewhere a reader cannot follow by reading. "Go to definition"
stops working, and the program's shape is only known at runtime.

```python
# implicit: which commands exist depends on which modules happened to be imported
@command("sync")
def sync() -> None: ...

# explicit: the list is in one place, and searching for a name finds its caller
COMMANDS: dict[str, Callable[[], None]] = {"sync": sync, "status": status}
```

Start explicit. Move toward implicit when the explicit list has become the
thing people get wrong (they keep forgetting to register), or when a
framework's conventions are already the shared vocabulary of the codebase.

### Written to change ↔ written to teach

Most code is read by someone about to change it: optimise for finding the
right place and changing it safely. Some code is read to understand an idea:
an algorithm, a domain model, a clever data structure. There, write for a
learner: cite the paper, explain the approach, keep the steps visible even
at the cost of brevity.

```python
Node = str
Graph = dict[Node, dict[Node, float]]   # node -> {neighbour: edge weight}

def shortest_paths(graph: Graph, source: Node) -> dict[Node, float]:
    """Dijkstra's algorithm (Dijkstra, 1959).

    Repeatedly settle the closest unsettled node; its distance is final
    because all edge weights are non-negative.
    """
    distance = {source: 0.0}
    frontier = [(0.0, source)]
    settled: set[Node] = set()
    while frontier:
        dist, node = heappop(frontier)
        if node in settled:
            continue
        settled.add(node)
        for neighbour, weight in graph.get(node, {}).items():   # sinks have no key
            candidate = dist + weight
            if candidate < distance.get(neighbour, inf):
                distance[neighbour] = candidate
                heappush(frontier, (candidate, neighbour))
    return distance
```

The docstring here is longer than usual on purpose: it carries the idea
the code depends on.

### Obvious ↔ fast

Write the obvious version. Trade clarity for speed only where a measurement
says it matters, and keep the fast part small and well-labelled.

Often there is no trade: picking the right data structure is both clearer
and faster, so take it without waiting for a profiler.

```python
@dataclass(frozen=True)
class Order:
    id: str

# quadratic: `in` scans the whole list for every order
def new_orders(orders: list[Order], seen_ids: list[str]) -> list[Order]:
    return [o for o in orders if o.id not in seen_ids]

# linear, and the type now says what the collection is: a set of ids
def new_orders(orders: list[Order], seen_ids: set[str]) -> list[Order]:
    return [o for o in orders if o.id not in seen_ids]
```

The real trade starts after that: caches, batching, hand-rolled loops. Each
one is another state to keep correct, so it waits for a measurement. The
same goes for clever algorithms: they have bigger constants and more bugs,
and are slow when n is small, which it usually is. Until you know n is
large, use the plain list, dict, set or sort.

## 5. Defaults

When no force is pulling a slider, start here. These are defaults for new
code; in existing code the patterns already there win (§4, consistent ↔
expressive), until the team agrees to migrate.

**Shape of a program**

- The entry point reads as the plan: the steps in order, each a single call.
  It owns the order; the functions own the details.
- Read configuration and environment once, at the entry point, and pass down
  the values each function needs, not the whole config.

  ```python
  # not this: every function can reach anything
  def write_report(orders: list[Order], config: Config) -> None: ...

  # this: the signature says what it uses
  def write_report(orders: list[Order], output: Path) -> None: ...
  ```
- A file reads top to bottom: types and constants first (a constant follows
  the types it is built from), then functions in the order they run, `main`
  last. Constants live together near the top of the file that uses them,
  not scattered above functions far down the file. Grouped there, they are
  an anchor: every tunable value of the file in one place. A constant that
  several modules share lives with the concept it belongs to, not in a
  generic constants module.
- Extract a block into a function when its name replaces a comment, or when
  the block is at a lower level of detail than its neighbours. The steps of
  an entry point pass that test. Otherwise a helper with one call site is
  inlined.
- Handle the exceptional cases first and return early, so the main path runs
  down the left margin:

  ```python
  # nested: the actual work is three levels deep, and the else is far from its if
  def ship(order: Order) -> None:
      if not order.cancelled:
          if order.paid:
              carrier.book(order)
          else:
              raise Unpaid(order.id)

  # guard clauses: each exit is next to its reason, the work is last
  def ship(order: Order) -> None:
      if order.cancelled:
          return   # nothing to ship: a valid outcome, not a failure
      if not order.paid:
          raise Unpaid(order.id)
      carrier.book(order)
  ```
- Keep one level of abstraction per function: a function that calls
  `fetch_orders()` should not also be slicing strings.
- Name the parts of a long condition. It reads as the rule it encodes, and
  each part can be inspected in a debugger:

  ```python
  is_late = order.due < today
  is_unpaid = order.paid_amount < order.total
  if is_late and is_unpaid and not customer.on_payment_plan:
      send_reminder(order)
  ```

**Names**

- Names say what the thing does, in the problem's vocabulary: `overdue`,
  `invoice`, `carrier`, not `process`, `data`, `item`.
- Length follows scope: `i` in a three-line loop, `pending_invoices` across
  a module, a full phrase for a public function.
- `Manager`, `Helper`, `utils` and `common` are names of a place, not of a
  thing. Shared code goes in the feature that owns the concept, or in its own
  module once the concept has a real name.
- Booleans read as statements that are true or false (`paid`, `cancelled`,
  `has_config`), never `flag` or `status`; functions that return
  something are named for what they return, those that act for what they do.
- When a name is hard to find, the thing usually does two jobs.

**Data and state**

- Design the data first. "Show me your tables, and I won't usually need your
  flowcharts; they'll be obvious" (Fred Brooks). Once the data structures
  are right, the code tends to follow (Rob Pike).
- Make illegal states unrepresentable. If a value can only be one of three
  things, its type should say so, so that no function has to check:

  ```python
  # two fields that must agree: Job(done=False, error="disk full") is legal
  @dataclass(frozen=True)
  class Job:
      done: bool
      error: str | None

  # one type per state: an error exists only on a failed job
  @dataclass(frozen=True)
  class Running: ...
  @dataclass(frozen=True)
  class Succeeded: ...
  @dataclass(frozen=True)
  class Failed:
      error: str

  JobState = Running | Succeeded | Failed
  ```
- Match every state explicitly. The only `case _` left is `assert_never`, a
  guard for the type checker: adding a state makes it point at every place
  that must decide what to do with it. Unknown external values never get
  this far; they are rejected at the parse boundary.

  ```python
  def label(state: JobState) -> str:
      match state:
          case Running():
              return "running"
          case Succeeded():
              return "done"
          case Failed(error):
              return f"failed: {error}"
          case _:
              assert_never(state)   # a new state fails type checking here
  ```
- Values over mutable state. A frozen record can be passed anywhere without
  asking who else changes it; that is why the records in this guide are
  `frozen=True`. Mutate locally, inside one function, where the reader can
  see it all; never mutate an argument, return a new value instead.
- No module-level mutable state. A global that changes is a hidden argument
  to every function that reads it.

**Interfaces**

- Make modules deep: a small interface with a lot of work behind it (John
  Ousterhout).
- Close the interface: required arguments over optional ones with fallbacks,
  the narrowest type the data allows, no default nobody needs.
- Type everything, even where the language does not require it: records as
  typed values, not dictionaries with known keys (a mapping that is the
  data's natural shape, like a graph, is fine). Signatures
  show how data flows without reading the bodies, the checker guards every
  boundary between functions, and the editor can complete and navigate.
- Return what the caller needs, not an object it has to unpack.

**Boundaries and errors**

- Parse, don't validate (Alexis King): the parsed type carries the proof.
  A `Port` that exists is a valid port. Parse untrusted input once, where it
  enters and before acting on any of it, then trust it:

  ```python
  @dataclass(frozen=True)
  class Port:
      number: int

      def __post_init__(self) -> None:
          if not 1 <= self.number <= 65535:
              raise ValueError(f"port out of range: {self.number}")

  port = Port(int(os.environ["PORT"]))   # every function after this takes a Port
  ```

  A check that returns nothing (`check_port(raw) -> None`) throws away what
  it learned, nothing stops a caller from skipping it, and checks scattered
  through the processing leave half-done work behind when a late one fails.
- Fail fast and loudly, with the value that caused the failure.
- Errors are part of the interface. Raise a specific type the caller can
  act on (`Unpaid`, `NotFound`), not a bare `Exception` or a string. A parse
  failure that only `main` reports can stay a `ValueError`.
- Catch where you can do something about it: retry, fall back, or report to
  the user. Usually that is the edge, near `main`. A `try` that only logs and
  re-raises, or swallows, in the middle of the code adds noise and hides
  failures.
- No handling for states that cannot occur. Design for the failures that
  really happen: timeouts, kills, retries, partial writes.
- Make operations safe to repeat. A step that is killed halfway will be run
  again; if running it twice gives the same result as once, a retry is
  always the recovery. Write to a temporary file and rename it over the
  target, create only if absent, use upserts.
- Anything that needs manual recovery also needs detection: an alert, a
  non-zero exit, a status someone looks at. A failure nobody sees is the
  expensive kind.
- Log events a person will act on or search for, with the identifiers needed
  to find them (`order_id=123 carrier=dhl`), not a narration of each step.

**Dependencies and tools**

- Prefer boring technology. Each new language, database or framework spends
  one of a few "innovation tokens" (Dan McKinley). Boring means its failure
  modes are known, not just that it is familiar. Judge a new tool by what it
  costs the whole system (operations, monitoring, one more thing to learn),
  not by how well it fits one problem, and first write down why the tools
  you already have cannot do it.
- Standard library before custom machinery.
- A clean repository root: a readme, the manifest, shared config, one entry
  point for setup, check and run. Everything else in directories.

**Tests**

- Test behaviour through the public interface, not implementation details.
  A refactor that keeps behaviour must not break a test.
- Most tests on the pure core, a few through the real boundaries. The split
  follows the shape of the code: the core has many paths and no
  dependencies, so it gets many small unit tests; the shell has many
  dependencies and few paths, so one integration test that checks the parts
  line up is enough.
- Prefer real values and simple fakes to mocks:

  ```python
  # mock: breaks if register() batches or renames save, though nothing visible changed
  def test_register_saves_user() -> None:
      store = Mock()
      register(user, store)
      store.save.assert_called_once_with(user)

  # fake: checks what a caller can observe
  def test_registered_user_can_be_found() -> None:
      store = InMemoryUsers()
      register(user, store)
      assert store.get(user.id) == user
  ```

  When the interaction is the contract (an email sent exactly once, a card
  not charged twice), a mock or spy at the edge is the right tool: the call
  is the behaviour. Keep a fake honest with one test, parametrised over the
  fake and the real thing, that both must pass.
- Name a test for the behaviour it pins down
  (`test_paid_invoice_is_not_overdue`), and keep its arrange, act and assert
  visible in the body. A test should read as an example of how the code is
  used.
- When a bug is found, write the test that fails first.
- One command runs everything.
- Tests and types catch mistakes and document intent; they do not make a
  tangled structure understandable.

**Comments and docs**

- Comment the why, never the what.

  ```python
  # what: repeats the code
  retries += 1  # increment retries

  # why: something the code cannot say
  time.sleep(1)  # the API allows one call per second per token
  ```
- A comment that a refactor would silently make wrong (a line number, a
  caller's name, "the only place that…") should not be written.
- Docstrings say what the caller needs that the signature does not: the
  contract, a subtle failure mode, the idea behind code written to teach
  (§4). When the signature already says it all, skip the docstring.
- Every rationale lives in exactly one place.
- Docs say how it works now. Version control is the history.

**Changes**

- Restructure and change behaviour in separate steps (§3).
- Keep each change to one concern.
- Delete dead code, options and superseded approaches outright.
- When you simplify a condition, re-check what it did with empty, missing
  and `None`: shorter rewrites are where behaviour quietly changes.

## 6. Taste

Rules get you to decent code. The last stretch is taste, and taste is less
mysterious than it sounds: it can be learned, because good design has
recognisable properties.

A working definition: **beautiful code still reads well six months later, to
someone who does not share your context.** That someone is often you. Code
that only feels elegant because you remember writing it fails the test.

What makes code pass it:

- **It solves the right problem.** Before simplifying a solution, question
  the problem: a simple answer to the wrong question is still wrong, and a
  reframed problem is often easy where the original was hard.
- **It says the problem.** Names and shape mirror the domain, so the code
  reads as a description of what it solves.
- **What changes together lives together.** One concept's properties in one
  place (the entities in §4), one feature's files in one folder (§4), one rationale in one
  doc (§5). Things that change for different reasons stay apart, even when
  they look alike (the validators in §4).
- **The common case is obvious**, and the rare case is possible.
- **Special cases disappear** instead of being handled. Linus Torvalds'
  well-known "good taste" example removes the head-of-list special case from
  linked-list deletion by pointing at the link instead of the node:

  ```c
  void remove(List *list, Node *target) {
      Node *prev = NULL, *walk = list->head;
      while (walk != target) {
          prev = walk;
          walk = walk->next;
      }
      if (prev == NULL)
          list->head = target->next;
      else
          prev->next = target->next;
  }
  ```

  ```c
  void remove(List *list, Node *target) {
      Node **link = &list->head;
      while (*link != target)
          link = &(*link)->next;
      *link = target->next;
  }
  ```

  Notice what changed: the head is not a different case, only a different
  link, so the `if` goes away rather than moving somewhere else.

And finally, the test underneath every slider in this guide:

> Complexity that reflects the problem stays. Complexity that reflects
> indecision, a past design or an imagined future goes.

### A complete idea in thirty lines

Taste is learned by reading more than by following rules. One piece worth
reading closely is Rob Pike's regular-expression matcher, as Brian Kernighan
presents it in *Beautiful Code*. It handles `c`, `.`, `^`, `$` and `*`, and
each function handles one shape of pattern: anywhere in the text, at this
position, or a starred character:

```c
int match(char *re, char *text) {
    if (re[0] == '^')
        return matchhere(re + 1, text);
    do {
        if (matchhere(re, text))
            return 1;
    } while (*text++ != '\0');
    return 0;
}

int matchhere(char *re, char *text) {
    if (re[0] == '\0')
        return 1;
    if (re[1] == '*')
        return matchstar(re[0], re + 2, text);
    if (re[0] == '$' && re[1] == '\0')
        return *text == '\0';
    if (*text != '\0' && (re[0] == '.' || re[0] == *text))
        return matchhere(re + 1, text + 1);
    return 0;
}

int matchstar(int c, char *re, char *text) {
    do {
        if (matchhere(re, text))
            return 1;
    } while (*text != '\0' && (*text++ == c || c == '.'));
    return 0;
}
```

What to notice: there is one function per shape of pattern, and each call
consumes one piece of the pattern, so the recursion mirrors the pattern's
grammar. No flags, modes or state are passed along; `^`, `$` and `*` are
each handled once, where that shape is recognised.

## Further reading

### Books

- John Ousterhout, *A Philosophy of Software Design* (Yaknyam Press, 2nd ed. 2021): deep modules, complexity as the thing to manage.
- Kent Beck, *Tidy First?* (O'Reilly, 2023): make the change easy, then make the easy change.
- Fred Brooks, *The Mythical Man-Month* (Addison-Wesley, anniversary ed. 1995), chapter 9: representation is the essence of programming.
- Andy Oram and Greg Wilson (eds.), *Beautiful Code* (O'Reilly, 2007), chapter 1: Kernighan on Pike's matcher.

### Talks

- Rich Hickey, [Simple Made Easy](https://www.youtube.com/watch?v=SxdOUGdseq4) (Strange Loop 2011; transcript in the `matthiasn/talk-transcripts` GitHub repo): simple versus easy.
- Gary Bernhardt, [Boundaries](https://www.destroyallsoftware.com/talks/boundaries) (2012): functional core, imperative shell; values as the boundary.

### Essays and articles

- Carson Gross, [The Grug Brained Developer](https://grugbrain.dev): factor late, fear complexity.
- Martin Fowler, [Yagni](https://martinfowler.com/bliki/Yagni.html): the costs of building ahead of need.
- Dan McKinley, [Choose Boring Technology](https://mcfunley.com/choose-boring-technology): innovation tokens.
- Alexis King, [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).
- Yaron Minsky, [Effective ML Revisited](https://blog.janestreet.com/effective-ml-revisited/): make illegal states unrepresentable (code only; the point is that a state the types forbid cannot occur at runtime).
- Rob Pike, [Notes on Programming in C](https://doc.cat-v.org/bell_labs/pikestyle) (1989): data dominates, names scaled to scope.
- Casey Muratori, ["Clean" Code, Horrible Performance](https://www.computerenhance.com/p/clean-code-horrible-performance) (article and video): the shapes benchmark.
- Dan Abramov, [Goodbye, Clean Code](https://overreacted.io/goodbye-clean-code/): an abstraction that removed duplication and blocked the next change.
- Paul Graham, [Taste for Makers](https://paulgraham.com/taste.html) (also in his book *Hackers & Painters*): what good design has in common.

### Code

- [SQLite](https://sqlite.org/src): documentation that matches the code, and tests that explain it.
- [NetworkX](https://github.com/networkx/networkx): algorithms that cite the paper they implement, with little indirection between you and the idea.
