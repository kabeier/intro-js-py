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
