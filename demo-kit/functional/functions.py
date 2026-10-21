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
