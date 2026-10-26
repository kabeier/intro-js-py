# Code and commands, in order

Every file both lectures type, as it ends up, with the output it prints (run with real `node` / `python3` when this file was made). The slides' codepad types the same code in chunks.


## Lecture 1: JS & Python Fundamentals (folder `fundamentals/`: `.js` files in `js/`, `.py` files in `python/`)

```bash
mkdir fundamentals
cd fundamentals
code .
node --version
python3 --version
```


### Your first two files

**example.js**
```js
console.log("Hello from JavaScript");
```
`node example.js` prints:
```
Hello from JavaScript
```

**example.py**
```python
print("Hello from Python")
```
`python3 example.py` prints:
```
Hello from Python
```


### Variables and naming

**variables.js**
```js
let userName = "Alex";
console.log(userName);

// change what's in the box (no let the second time)
userName = "Sam";
console.log(userName);

// camelCase for variables, UPPER_CASE for constants
let favoriteColor = "blue";
let MAX_USERS = 30;
console.log(favoriteColor, MAX_USERS);
```
`node variables.js` prints:
```
Alex
Sam
blue 30
```

**variables.py**
```python
user_name = "Alex"
print(user_name)

# change what's in the box
user_name = "Sam"
print(user_name)

# snake_case for variables, UPPER_CASE for constants
favorite_color = "blue"
MAX_USERS = 30
print(favorite_color, MAX_USERS)
```
`python3 variables.py` prints:
```
Alex
Sam
blue 30
```


### Primitive types: one value each

**primitives.js**
```js
let message = "Hello, world!";
console.log(message);
let count = 10;
console.log(count);

let isActive = true;
console.log(isActive);
let data = null;
console.log(data);

let price = 9.99;
console.log(typeof price, typeof count);
let value;
console.log(value);
```
`node primitives.js` prints:
```
Hello, world!
10
true
null
number number
undefined
```

**primitives.py**
```python
message = "Hello, world!"
print(message)
count = 10
print(count)

is_active = True
print(is_active)
data = None
print(data)

price = 9.99
print(type(price), type(count))
```
`python3 primitives.py` prints:
```
Hello, world!
10
True
None
<class 'float'> <class 'int'>
```


### Lists, objects and dicts

**collections.js**
```js
// idxs         0       1       2
let colors = ["red", "green", "blue"];
console.log(colors);
console.log(colors[1]);

let user = { name: "Alex", age: 30 };
console.log(user);
console.log(user.name);

// bracket notation: add, then remove
user["city"] = "Chicago";
delete user.age;
console.log(user);
```
`node collections.js` prints:
```
[ 'red', 'green', 'blue' ]
green
{ name: 'Alex', age: 30 }
Alex
{ name: 'Alex', city: 'Chicago' }
```

**collections.py**
```python
# idxs      0       1        2
colors = ["red", "green", "blue"]
print(colors)
print(colors[1])

user = {"name": "Alex", "age": 30}
print(user)
print(user.get("name"))

# bracket notation: add, then remove
user["city"] = "Chicago"
del user["age"]
print(user)
```
`python3 collections.py` prints:
```
['red', 'green', 'blue']
green
{'name': 'Alex', 'age': 30}
Alex
{'name': 'Alex', 'city': 'Chicago'}
```


### Can it change?

**mutable.js**
```js
// a list is mutable: it changes in place
let colors = ["red", "green"];
colors.push("blue");
console.log(colors);

// a string is immutable: you get a NEW string
let name = "alex";
let loud = name.toUpperCase();
console.log(name, loud);

// the bug: two labels, one list
let copy = colors;
copy.push("pink");
console.log(colors);
```
`node mutable.js` prints:
```
[ 'red', 'green', 'blue' ]
alex ALEX
[ 'red', 'green', 'blue', 'pink' ]
```

**mutable.py**
```python
# a list is mutable: it changes in place
colors = ["red", "green"]
colors.append("blue")
print(colors)

# a string is immutable: you get a NEW string
name = "alex"
loud = name.upper()
print(name, loud)

# the bug: two labels, one list
copy = colors
copy.append("pink")
print(colors)
```
`python3 mutable.py` prints:
```
['red', 'green', 'blue']
alex ALEX
['red', 'green', 'blue', 'pink']
```


### Running any file (both lectures)
```bash
# terminal 1
cd js
docker build -t js-fundamentals .
docker run --rm --init js-fundamentals node example.js       # Hello from JavaScript
# terminal 2
cd python
docker build -t py-fundamentals .
docker run --rm --init py-fundamentals python3 example.py    # Hello from Python
```
Lecture 2: the same in `functional/js` and `functional/python`, images `js-functional` / `py-functional`.
No node / python3 on a student laptop:
```bash
docker run --rm -v "$PWD":/app -w /app node:18-alpine node example.js
docker run --rm -v "$PWD":/app -w /app python:3.11-slim python3 example.py
```


## Lecture 2: Functional Programming (folder `functional/`: `.js` files in `js/`, `.py` files in `python/`)

```bash
mkdir functional
cd functional
code .
```


### Comparisons give true or false

**compare.js**
```js
let age = 18;
console.log(age >= 18);
console.log(age < 18);
console.log(age === 18, age !== 21);

// === also checks the type. Use it.
console.log(5 == "5");
console.log(5 === "5");
```
`node compare.js` prints:
```
true
false
true true
true
false
```

**compare.py**
```python
age = 18
print(age >= 18)
print(age < 18)
print(age == 18, age != 21)

# Python's == never mixes types
print(5 == "5")
```
`python3 compare.py` prints:
```
True
False
True True
False
```


### if / else if / else

**conditionals.js**
```js
let score = 85;

if (score >= 90) {
  console.log("Pass with Honors");
} else if (score >= 70) {
  console.log("Pass");
} else {
  console.log("Fail");
}

// AND: both must be true
let age = 21;
let hasId = true;

if (age >= 21 && hasId) {
  console.log("This adult can drink");
} else if (age >= 18) {
  console.log("This is an adult but can't drink");
} else {
  console.log("This person is a minor");
}
```
`node conditionals.js` prints:
```
Pass
This adult can drink
```

**conditionals.py**
```python
score = 85

if score >= 90:
    print("Pass with Honors")
elif score >= 70:
    print("Pass")
else:
    print("Fail")

# OR: one of the two is enough
hungry = False
bored = True

if hungry or bored:
    print("cook a meal")
else:
    print("You don't need to eat")
```
`python3 conditionals.py` prints:
```
Pass
cook a meal
```


### Loop a list: by value, by index, or both

**loops.js**
```js
let colors = ["red", "green", "blue"];

// by value: for...of
for (let color of colors) {
  console.log(color);
}

// by index
for (let i = 0; i < colors.length; i++) {
  console.log(i, colors[i]);
}

// both
for (const [idx, color] of colors.entries()) {
  console.log(idx, color);
}
```
`node loops.js` prints:
```
red
green
blue
0 red
1 green
2 blue
0 red
1 green
2 blue
```

**loops.py**
```python
colors = ["red", "green", "blue"]

# by value: for...in
for color in colors:
    print(color)

# by index
for idx in range(len(colors)):
    print(idx, colors[idx])

# both
for idx, color in enumerate(colors):
    print(idx, color)
```
`python3 loops.py` prints:
```
red
green
blue
0 red
1 green
2 blue
0 red
1 green
2 blue
```


### Loop an object or dict, then while

**more-loops.js**
```js
let user = { name: "Alex", age: 30 };

for (let key in user) {
  console.log(key);
}
for (let [key, value] of Object.entries(user)) {
  console.log(key, value);
}

let count = 0;
while (count < 3) {
  console.log(count);
  count++;
}
```
`node more-loops.js` prints:
```
name
age
name Alex
age 30
0
1
2
```

**more-loops.py**
```python
user = {"name": "Alex", "age": 30}

for key in user:
    print(key)
for key, value in user.items():
    print(key, value)

count = 0
while count < 3:
    print(count)
    count += 1
```
`python3 more-loops.py` prints:
```
name
age
name Alex
age 30
0
1
2
```


### Write it once, call it often

**functions.js**
```js
function sayHi() {
  console.log("Good Afternoon");
}

sayHi();
sayHi();

// name is a parameter; "Alice" is the argument
function greet(name) {
  return "Good Afternoon " + name;
}

greet("Alice");
let result = greet("Sam");
console.log(result);
```
`node functions.js` prints:
```
Good Afternoon
Good Afternoon
Good Afternoon Sam
```

**functions.py**
```python
def say_hi():
    print("Good Afternoon")

say_hi()
say_hi()

# name is a parameter; "Alice" is the argument
def greet(name):
    return "Good Afternoon " + name

greet("Alice")
result = greet("Sam")
print(result)
```
`python3 functions.py` prints:
```
Good Afternoon
Good Afternoon
Good Afternoon Sam
```


### Arrow, lambda, filter, sort, map

**functional.js**
```js
const multiply = (a, b) => a * b;
console.log(multiply(3, 4));

let nums = [3, 1, 4, 2];
let evens = nums.filter(n => n % 2 === 0);
let doubled = nums.map(n => n * 2);
console.log(evens, doubled, nums);

nums.sort((a, b) => a - b);
console.log(nums);
```
`node functional.js` prints:
```
12
[ 4, 2 ] [ 6, 2, 8, 4 ] [ 3, 1, 4, 2 ]
[ 1, 2, 3, 4 ]
```

**functional.py**
```python
multiply = lambda a, b: a * b
print(multiply(3, 4))

nums = [3, 1, 4, 2]
evens = list(filter(lambda n: n % 2 == 0, nums))
doubled = [n * 2 for n in nums]
print(evens, doubled, nums)

sorted_nums = sorted(nums)
print(sorted_nums, nums)
```
`python3 functional.py` prints:
```
12
[4, 2] [6, 2, 8, 4] [3, 1, 4, 2]
[1, 2, 3, 4] [3, 1, 4, 2]
```


## Homework: the "Or ask Claude" prompt (commit and push an assignment)
```
Run git status and show me the list of files. Then suggest a commit message for my solution and wait for my approval. After I approve, commit and push to my fork.
```
