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
