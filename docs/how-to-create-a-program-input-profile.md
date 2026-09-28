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
@title Multiple Integer Input
@input target=x value=4 min=1 max=20
@input target=y value=7 min=1 max=20
*/
```

`value` is the authored input. `min` and `max` are inclusive integer limits.
An input destination without matching metadata is rejected so the simulation
cannot invent an unexplained value.

Supported initial statements are:

```c
scanf("%d %d", &x, &y);
```

```java
x = input.nextInt();
```

The destination must be a declared mutable `int`. C supports `%d` and `%i`.

## 3. Configure the profile

Declare the profile in `js/profiles.js`:

```js
{
  enabled:true,
  meta:{id:'my-input-profile',name:'Program Input',description:'Trace console input.'},
  shape:{operandSources:{variable:2},operandRange:{min:1,max:20},allowNegativeOperands:false},
  operators:{allowed:OPS.ADD_SUB},
  template:'operand op operand',
  scoring:{itemCount:'manifest',pointsPerItem:2},
  content:{
    provider:'code-simulator',
    mode:'source-files',
    library:'source-programs',
    exerciseSet:'my-input-set',
    sourceValueMode:'authored',
    inputValueMode:'seeded',
    presentation:'source-flow',
    selection:{count:'all',shuffle:false}
  },
  program:{declarations:'interactive',scoreAssignments:true,
    timelinePresentation:'statement-modal'}
}
```

Use `inputValueMode:'authored'` to preserve each `value`. Use `'seeded'` to
choose a value from its source-local range whenever the item is regenerated.

## Learner flow

1. Click the input statement.
2. Click `scanf` or `nextInt()` to start input.
3. Watch the virtual keyboard enter the configured value. C whitespace is
   shown with the Space key.
4. Press Enter. The input is not committed before this action.
5. Watch all submitted values travel from Program Console to their matching
   format placeholders. Each placeholder shows a spinner until its value
   arrives.
6. In C, click each complete address expression, such as `&x`. The received
   placeholder value trails to its Memory card, then the card rolls to the new
   value. In Java, click the assignment target for the same transfer. Input
   remains visible in Program Console alongside output events.

The keyboard playback and console-to-placeholder trails are presentation.
Enter, the batch conversion, each memory write, scoring, Undo, Reset, and
persistence are semantic state transitions.
