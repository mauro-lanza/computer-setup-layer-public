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
complexity the problem actually has.

Examples are Python (C where noted) and omit imports.

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
         direct calls  <────>  layers and adapters
           hard-coded  <────>  configurable
```

Neither end is better. Each position is right for some code and wrong for
other code, and the same code can move along the line as it grows. What moves
the slider are **forces in the code itself**: how many cases exist, how
concepts relate, what keeps changing, what is expensive to undo.

The method is the same every time:

1. **Start at the cheapest position that works today.**
2. **Name the forces that are actually present**, in the code as it is now.
   Imagined forces don't count.
3. **Know what would make you move.** If that signal shows up, move. Until
   then, stay.
4. **Weigh the cost of moving later.** If moving is cheap, stay low. If it is
   expensive, starting further along is justified.

That last point is the honest answer to "why ever build structure up front?".
Some decisions are expensive to reverse by nature: a data format written to
disk, a database schema, a public interface other code is built against, a
wire protocol. Those deserve thought before the first line. Almost everything
else (how you split files, whether a helper exists, whether there is a base
class) can be changed in an afternoon, so it should follow the code, not lead
it.

## 3. Reading the code for signals

The signals that move a slider are things you notice while working, not
things anyone has to tell you.

**Toward more structure:**

- **The same edit, in several places, again.** You changed one idea and had
  to touch four files to do it, and this is not the first time.
- **A second real case exists.** Not "we might support Postgres someday", but
  a second backend, format or kind that is in the code now.
- **You can't hold a step in your head.** Understanding one part means
  remembering the internals of another.
- **Changes leak.** Touching one area keeps breaking an unrelated one.
- **Concepts are smeared.** The properties of one logical thing are computed
  in five places instead of living together.

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

  Each flag is a second function hiding inside the first.
- **You read through it more than you use it.** Every time you debug, you
  step into the abstraction to see what it really does.
- **The structure describes a past problem.** The code was organised for a
  requirement that no longer exists.

Re-evaluate whenever you start a meaningful change. Ask: given what this code
has become, is its structure still the right size? The answer may be to grow
it, to shrink it, or to leave it alone.

When the answer is to change, separate the moves:

> Make the change easy, then make the easy change. (Kent Beck)

Restructure first, with behaviour unchanged. Then add the feature on top of
the new shape. Two small steps you can verify beat one large step you can't.

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

**Abstract when it is plug and play.** An abstraction earns its place when it
lowers, or at least doesn't raise, what a reader must hold in their head:

- **The name is enough.** You can call `load_config(path)` or `retry(fn)`
  without opening it.
- **It hides one decision**: a file format, a retry policy, a client. It has
  one reason to change.
- **Callers plug in without bending it.** No flags or optional parameters to
  make a new caller fit.
- **The flow stays visible.** It abstracts a step, not the order of the steps.
- **It is cheap to undo.** Inlining it back is mechanical.

Compare:

```python
@dataclass(frozen=True)
class Config:
    source: str
    output: Path

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
    if len(user.name) < 2: raise Invalid("name")
    if user.age < 16: raise Invalid("age")

def validate_shipping(address: Address) -> None:    # carrier rule: what the courier accepts
    if len(address.name) < 2: raise Invalid("name")
    if address.country not in SHIPPABLE: raise Invalid("country")
```

A shared `validate_name_and_one_more_thing()` would save two lines, and the
first time the carrier demands a 35-character name limit it would need a
flag. Same shape, different reasons to change.

### Operations over data ↔ polymorphic entities

Take shapes. You can organise the logic by operation:

```python
@dataclass(frozen=True)
class Shape:
    kind: Literal["square", "rectangle", "triangle", "circle"]
    width: float
    height: float

COEFFICIENT = {"square": 1.0, "rectangle": 1.0, "triangle": 0.5, "circle": pi / 4}

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

class Circle(Shape):
    def __init__(self, radius: float) -> None:
        self.radius = radius
    def area(self) -> float:
        return pi * self.radius**2
    def perimeter(self) -> float:
        return 2 * pi * self.radius
    def bounds(self) -> Box:
        return Box(-self.radius, -self.radius, self.radius, self.radius)
```

With one or two operations that differ only in a number, the first version is
clearer: the whole idea fits on one screen, and it shows a pattern the class
hierarchy would hide. Casey Muratori makes this point with benchmarks too:
operations over plain data are often both faster and easier to read.

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
and it has its own costs: a second language, a loader, validation where the
file is read, and no type checking or editor help. It earns its place when
the data changes far more often than the logic, when there are several sets
of the same data (per machine, environment or customer) for one program,
when something other than the program reads or edits it, or when the data
has grown big enough to bury the logic. It does not, when entries need
callables, conditions or computed values: a data file that grows templating
is a worse programming language.

The type can follow the data out. A parsed file comes back as dictionaries,
and a `TypedDict` types them as they are, without converting to a dataclass:

```python
class ConfigFile(TypedDict):
    src: str
    dest: str

class Tool(TypedDict):
    id: str
    packages: list[str]
    config: list[ConfigFile]

def load_tools(path: Path) -> list[Tool]:
    tools = json.loads(path.read_text())
    validate_tools(tools)  # a TypedDict checks nothing at runtime
    return tools
```

Validate once where the file is read; from there on the type checker
guards every key.

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
protocol, a client. Modules that depend on each other's internals are one
module spread across files; splitting them adds jumps without hiding
anything.

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
def main() -> None:
    invoices = db.fetch_invoices()
    for invoice in overdue(invoices, date.today()):
        mailer.send_reminder(invoice)
```

`overdue` is tested with a list and a date, no database or mocks. Compare
the layered version you would build "just in case":

```text
domain/ports/invoice_repository.py     interface with one method
domain/ports/notifier.py               interface with one method
adapters/postgres_invoice_repository.py
adapters/smtp_notifier.py
application/send_reminders_use_case.py
```

Five files for one database and one mailer. If a second database arrives,
the one-function shell above becomes the adapter in minutes.

### Hard-coded ↔ configurable

A value that never changes is a constant, at the top of the file that uses it.
It becomes configuration when it really differs between environments,
machines or uses, and changing it should not need a code change. Every knob
is another thing that has to be documented, validated and tested. Add it on
the day the second value exists.

```python
# start: a constant at the top of the file that uses it
RETRY_ATTEMPTS = 3

# later, when staging really needs a different value
retry_attempts = int(os.environ["RETRY_ATTEMPTS"])   # read once, in main
```

### Consistent ↔ expressive

In existing code, follow the patterns already there, even when you know a
cleaner one. A better pattern used in one corner is one more pattern to
learn. If the existing pattern is truly wrong for the problem, change it
everywhere, as its own step, or not at all.

If every module in a codebase returns errors as `(result, error)` tuples,
the one module that raises exceptions forces every caller to handle both.
The cleaner style, applied in one place, made the whole codebase harder.

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
        for neighbour, weight in graph[node].items():
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
says it matters, and keep the fast part small and well-labelled. Often the
data-oriented version is both, which is a good reason to try it first.

```python
@dataclass(frozen=True)
class Customer:
    email: str

# obvious: fine until a profiler says otherwise
def find_customer(customers: list[Customer], email: str) -> Customer:
    return next(c for c in customers if c.email == email)

# fast: worth it when called thousands of times over the same list
def index_by_email(customers: list[Customer]) -> dict[str, Customer]:
    return {c.email: c for c in customers}   # build once, then index_by_email(customers)[email]
```

## 5. Defaults

When no force is pulling a slider, these are where I start.

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
- Constants and types first, then functions in the order they run, `main`
  last.
- A helper with one call site is inlined, unless its name is what makes the
  caller readable.
- Constants live together at the top of the file that uses them, not in a
  shared constants module and not scattered above the functions far down the
  file. Grouped at the top, they are an anchor: every tunable value of the
  file in one place, easy to find and to change.
- Names say what the thing does.

**Interfaces and data**

- Make modules deep: a small interface with a lot of work behind it (John
  Ousterhout).
- Close the interface: required arguments over optional ones with fallbacks,
  the narrowest type the data allows, no default nobody needs.
- Typed values between functions; dictionaries only where data is serialised.
- Return what the caller needs; don't mutate arguments.

**Boundaries and errors**

- Parse, don't validate: turn untrusted input into a typed value once, where
  it enters, then trust it (Alexis King).

  ```python
  @dataclass(frozen=True)
  class Port:
      number: int

      @classmethod
      def parse(cls, raw: str) -> "Port":
          number = int(raw)
          if not 1 <= number <= 65535:
              raise ValueError(f"port out of range: {raw}")
          return cls(number)

  port = Port.parse(os.environ["PORT"])   # every function after this takes a Port
  ```
- Fail fast and loudly, with the value that caused the failure.
- No handling for states that cannot occur. Design for the failures that
  really happen: timeouts, kills, retries, partial writes.

**Dependencies and tools**

- Prefer boring technology. Each new language, database or framework spends
  one of a few "innovation tokens" (Dan McKinley).
- Standard library before custom machinery, and read its actual behaviour
  before relying on it.
- A clean repository root: a readme, the manifest, shared config, one entry
  point for setup, check and run. Everything else in directories.

**Tests**

- Test behaviour through the public interface, not implementation details.
  A refactor that keeps behaviour must not break a test.
- Most tests on the pure core, a few through the real boundaries.
- One command runs everything.

**Comments and docs**

- Comment the why, never the what.

  ```python
  # what: repeats the code
  retries += 1  # increment retries

  # why: something the code cannot say
  time.sleep(2)  # the API rejects a second call within one second
  ```
- Every rationale lives in exactly one place.
- Docs say how it works now. Version control is the history.

**Changes**

- Restructure and change behaviour in separate steps.
- Keep each change to one concern.
- Delete dead code, options and superseded approaches outright.

## 6. Taste

Rules get you to decent code. The last stretch is taste, and taste is less
mysterious than it sounds.

A working definition: **beautiful code still reads well six months later, to
someone who does not share your context.** That someone is often you. Code
that only feels elegant because you remember writing it fails the test.

What makes code pass it:

- **It says the problem.** Names and shape mirror the domain, so the code
  reads as a description of what it solves.
- **What changes together lives together.**
- **The common case is obvious**, and the rare case is possible.
- **Special cases disappear** instead of being handled. Linus Torvalds'
  well-known "good taste" example removes the head-of-list special case from
  linked-list deletion by pointing at the link instead of the node:

  ```c
  void remove(List *list, Node *target) {
      Node **link = &list->head;
      while (*link != target)
          link = &(*link)->next;
      *link = target->next;
  }
  ```

And finally, the test underneath every slider in this guide:

> Complexity that reflects the problem stays. Complexity that reflects
> indecision, a past design or an imagined future goes.

### Code worth reading

Taste is learned by reading more than by following rules:

- **SQLite**: documentation that matches the code, and tests that explain it.
- **NetworkX**: algorithms that cite the paper they implement, with very
  little indirection between you and the idea.
- **Rob Pike's regular-expression matcher** (chapter 1 of *Beautiful Code*):
  a complete idea in about thirty lines. It handles `c`, `.`, `^`, `$` and
  `*`, and each function does exactly one of those jobs:

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

## Further reading

- John Ousterhout, *A Philosophy of Software Design*: deep modules.
- Carson Gross, [The Grug Brained Developer](https://grugbrain.dev): factor late, fear complexity.
- Martin Fowler, [Yagni](https://martinfowler.com/bliki/Yagni.html).
- Kent Beck, *Tidy First?*: make the change easy, then the easy change.
- Dan McKinley, [Choose Boring Technology](https://mcfunley.com/choose-boring-technology).
- Gary Bernhardt, [Boundaries](https://www.destroyallsoftware.com/talks/boundaries): functional core, imperative shell.
- Alexis King, [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).
- Casey Muratori, ["Clean" Code, Horrible Performance](https://www.computerenhance.com/p/clean-code-horrible-performance).
- Dan Abramov, [Goodbye, Clean Code](https://overreacted.io/goodbye-clean-code/).
- Paul Graham, [Taste for Makers](https://paulgraham.com/taste.html).
- Rich Hickey, *Simple Made Easy* (talk).
