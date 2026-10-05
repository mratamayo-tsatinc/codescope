# Create a Program Input profile

Program Input is a statement capability composed through Code Simulator. The
source file owns the input targets, authored values, and allowed random ranges.
The profile selects the source bank and decides whether those values stay
authored or are seeded.

## 1. Create the language folders

Add matching exercise sets under:

```text
exercise-libraries/source-programs/c/<exercise-set>/
exercise-libraries/source-programs/java/<exercise-set>/
```

Each folder needs a `manifest.json`. Only files listed in that manifest become
items.

## 2. Add input metadata to each source file

Use one `@input` directive for every input destination:

```c
/*
@codescope
@title Typed Input
@input target=x value=4 min=1 max=20 step=2
@input target=price value=9.5 min=5.0 max=20.0 step=0.5 decimals=1
@input target=letter value='B' choices='A'|'B'|'C'
@input target=name value="Ada" choices="Ada"|"Grace"|"Linus"
*/
```

`value` is the authored input. Numeric `min` and `max` are inclusive. Optional
`step` limits the generated sequence from `min`, and `decimals` controls the
rendered precision of generated floating point input. Character and string
inputs use `choices=` (the shared `values=` spelling is also accepted).
An input with only `value=` remains fixed in seeded mode.
An input destination without matching metadata is rejected so the simulation
cannot invent an unexplained value.

Supported C statements and destination types are:

```c
int count;
float price;
double rate;
char letter;
char name[24];
scanf("%d %f %lf %c %s", &count, &price, &rate, &letter, name);
```

Supported Java Scanner statements are:

```java
count = input.nextInt();
price = input.nextFloat();
rate = input.nextDouble();
letter = input.next().charAt(0);
name = input.next();
line = input.nextLine();
```

Destinations must be declared mutable variables with matching types. C supports
`%d`, `%i`, `%f`, `%lf`, `%c`, and `%s`. `%s` and Java `next()` accept one
whitespace-free token; Java `nextLine()` accepts spaces. C format literals are
preserved in the simulated input, so `%d/%d/%d` produces input such as
`10/2/2026`. Leading format whitespace such as `" %c"` consumes pending
whitespace and does not add a fabricated space before the entered character.

## 3. Configure the profile

Declare the profile in `js/profiles.js`:

```js
{
  enabled:true,
  meta:{id:'my-input-profile',name:'Program Input',description:'Trace console input.'},
  shape:{operandSources:{variable:2},operandRange:{min:1,max:20},allowNegativeOperands:false},
  operators:{allowed:OPS.ADD_SUB},
  template:'operand op operand',
  content:{
    mode:'source-files',
    source:{library:'source-programs',exerciseSet:'my-input-set'},
    values:{variables:'authored',input:'seeded'},
    selection:{count:'all',shuffle:false}
  },
  lesson:{focus:'input',variant:'numeric-console'},
  interaction:{declarations:'interactive'},
  presentation:{workspace:'source-program',timeline:'statement-modal'},
  scoring:{itemCount:'manifest',pointsPerItem:2,statementCommits:true}
}
```

Use `content.values.input:'authored'` to preserve each `value`. Use `'seeded'` to
choose a value from its source-local range whenever the item is regenerated.

## Learner flow

1. Click the input statement.
2. Click `scanf` or `nextInt()` to start input.
3. Watch the keyboard indicator while the configured input appears in the
   console one character at a time.
4. Press Enter. The input is not committed before this action.
5. Watch all submitted values travel from Program Console to their matching
   format placeholders. Each placeholder shows a spinner until its value
   arrives.
6. In C, click each complete address expression, such as `&x`. The received
   placeholder value trails to its Memory card, then the card rolls to the new
   value. In Java, click the assignment target for the same transfer. Input
   remains visible in Program Console alongside output events.

The keyboard indicator, persistent released/pressed Enter key, and
console-to-placeholder trails are presentation.
Enter, the batch conversion, each memory write, scoring, Undo, Reset, and
persistence are semantic state transitions.
