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
