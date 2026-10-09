# Label each note

Put labels in feedback-labels.json. The judge's scores are in feedback-judge.json; don't open it until you're done.

## 1. arrays · a-9278

**Question:** How do you remove an element from the end of an array?

**Reference:** (none)

**Learner answer:**

```
.shift
```

**Agent's note:** That removes from the front. Read the lesson again and look for the method that removes from the end.

## 2. html · a-4388

**Question:** What are the required elements in the `<head>` tag?

**Reference:** (none)

**Learner answer:**

```
The title is always required in the head tag. 
```

**Agent's note:** You've got one of them—what about the other required element in the `<head>` that the lesson calls out?

## 3. arrays · a-9691

**Question:** What does `.unshift()` do?

**Reference:** (none)

**Learner answer:**

```
Remove an element from front of array
```

**Agent's note:** You're describing what `.shift()` does—check the lesson again and notice which method adds versus removes.

## 4. html · a-5420

**Question:** What are the required elements in the `<head>` tag?

**Reference:** (none)

**Learner answer:**

```
The meta charset tag is also required.

```html
<meta charset="utf-8">
```
```

**Agent's note:** You've correctly identified one required element in the `<head>`, but the question asks for all the required elements—what else needs to be there?

## 5. arrays · a-10689

**Question:** How do you tell how many elements are in an array?

**Reference:** (none)

**Learner answer:**

```
using the .list method will allow us to determine how many items are contained within an array. It is important to note that this length sum will NOT be a 0 start, that is to say the length will start with 1 not 0.
```

**Agent's note:** You've got the right idea about the non-zero-based part, but check the name of the property you're using to get the length of an array.

## 6. html · a-3384

**Question:** What are the required elements in the `<head>` tag?

**Reference:** (none)

**Learner answer:**

```
there are no REQUIRED elements, but essential minimums should include meta charset and title
```

**Agent's note:** The lesson calls both `<title>` and `<meta charset>` required elements of the `<head>`. What's the distinction you're making between 'required' and 'essential minimums'?

## 7. arrays · a-11516

**Question:** How do you read an element from the start of an array without removing it?

**Reference:** (none)

**Learner answer:**

```
```js
arrayName.at(0)
```
```

**Agent's note:** The `.at()` method works, but it's not covered in the lesson—and there's a simpler approach using what you learned about array indexing. What would you use to read the first element?

## 8. html · a-7848

**Question:** What is an HTML doctype?

**Reference:** (none)

**Learner answer:**

```
```html
<!doctype> 
`````

Declares the document is being written in HTML 5.
```

**Agent's note:** You've got the right idea about what it declares, but look at the actual syntax in the lesson—the doctype tag needs something after the word doctype.

## 9. arrays · a-11003

**Question:** How do you read an element from the end of an array of unknown length without removing it?

**Reference:** (none)

**Learner answer:**

```
In a two step process; You would first determine the length of the array using .length, then you would then use the console.log(someArray[x]) where x is the index position of the last element in the array 
```

**Agent's note:** You've got the right approach—use `.length` to find where the last element is—but you need to be precise about how to calculate that index. What would `x` actually be if the array has length 3?

## 10. html · a-3959

**Question:** What is an HTML attribute?

**Reference:** (none)

**Learner answer:**

```
Used in the opening tag to specify the type of element it is.
```

**Agent's note:** That sounds more like what a tag does. An attribute is something that goes inside the tag—look at the examples with `id`, `class`, `type`, and `required` to see what we're talking about.

## 11. arrays · a-10747

**Question:** How do you read an element from the end of an array of unknown length without removing it?

**Reference:** (none)

**Learner answer:**

```
```js
const i = someArray.length()
someArray[i-1]
```
```

**Agent's note:** You're on the right track with indexing from the end, but `.length` is a property, not a method—no parentheses needed. Also double-check your index math: if the length is 3, what index holds the last element?

## 12. html · a-4377

**Question:** What is an HTML attribute?

**Reference:** (none)

**Learner answer:**

```
It is used with the HTML element tag and specifies the path, link, or additional information in an HTML element tag. 
```

**Agent's note:** You're thinking of how attributes are used, but your answer mixes together different kinds of things attributes do. What is an attribute itself—what's its role or structure in an HTML tag?

## 13. arrays · a-10793

**Question:** What is an off-by-one error?

**Reference:** (none)

**Learner answer:**

```
When one tries to access an array that might not exist by forgetting the index value starts with 0 
```

**Agent's note:** You've got part of it—zero-based indexing is definitely involved—but an off-by-one error is more specific than just forgetting that arrays start at 0. Think about what happens when you use `<=` instead of `<` in a loop condition, or when you're off by one in your count.

## 14. html · a-3519

**Question:** What happens if you don't close an HTML tag?

**Reference:** (none)

**Learner answer:**

```
The syntax will be incorrect and you will get an error.
```

**Agent's note:** Not quite—most browsers are pretty forgiving about unclosed tags. Look at the lesson passage about HTML Style: what actually happens when tags aren't closed?

## 15. arrays · a-12924

**Question:** Combine these two arrays:

```js
const firstArray = ["A", "B", "C"]
const secondArray = ["D", "E", "F"]
```

**Reference:** (none)

**Learner answer:**

```
Const newArray = firstArray.concat(secondArray);
```

**Agent's note:** You've got the right idea about combining arrays, but the lesson didn't cover the `.concat` method—take another look at what tools the lesson actually introduces for working with arrays.

## 16. html · a-4953

**Question:** What is an HTML tag?

**Reference:** (none)

**Learner answer:**

```
The beginning of a directive provided by the user to instruct the browser how content should be viewed. 
```

**Agent's note:** You're on the right track that tags instruct the browser, but the lesson describes tags more specifically in terms of their structure. Look at the anatomy diagrams and the components that make up a tag.

## 17. arrays · a-10364

**Question:** How do you read an element from the end of an array of unknown length without removing it?

**Reference:** (none)

**Learner answer:**

```
use .length to determine the length and then display that item based on the index.
```

**Agent's note:** You're on the right track with `.length`, but think through the math: if an array has length 3, what index gives you the last element?

## 18. html · a-2378

**Question:** What happens if you don't close an HTML tag?

**Reference:** (none)

**Learner answer:**

```
everything you put after would be considered a part of the tag, likely would cause the page to not display correctly
```

**Agent's note:** You're on the right track that it causes display problems, but think more carefully about what the browser does with the unclosed tag and the content that follows it.

## 19. arrays · a-10035

**Question:** How do you read an element from the start of an array without removing it?

**Reference:** (none)

**Learner answer:**

```
.index[0]
```

**Agent's note:** You're thinking about accessing by index, which is the right idea. But `.index[0]` isn't the syntax—how would you actually write it to get the first element of an array called `myArray`?

## 20. html · a-4960

**Question:** What happens if you don't close an HTML tag?

**Reference:** (none)

**Learner answer:**

```
The tag will not function. 
```

**Agent's note:** That's too simple—browsers are pretty forgiving about unclosed tags. What actually happens depends on which tag it is and what comes after it. Look at the example in the lesson again and think about how the browser might interpret the rest of the page.

## 21. arrays · a-9649

**Question:** How do you add an element to the end of an array?

**Reference:** (none)

**Learner answer:**

```
.push or ...array, [number]
```

**Agent's note:** You've got `.push` right, but what is the `...array, [number]` syntax about? That doesn't match how you'd actually add an element to an array.

## 22. html · a-3103

**Question:** What is an HTML attribute?

**Reference:** (none)

**Learner answer:**

```
A piece of the markup language that controls the behavior of the element within the tag
```

**Agent's note:** You're describing what an attribute does, but the question asks what it *is*. Think about the structure: where does an attribute live, and what does it look like in the tag itself?

## 23. arrays · a-11360

**Question:** What is spreading an array? Why would you use it?

**Reference:** (none)

**Learner answer:**

```
It allows you to add to an existing array. Used when all of the items from an array need to be used for another list. 
```

**Agent's note:** You've got the idea that spreading is useful for combining arrays, but you're missing the key advantage shown in the lesson. What makes spreading different from methods like `.push`?

## 24. html · a-4904

**Question:** What is an HTML attribute?

**Reference:** (none)

**Learner answer:**

```
The attribute is the property of a tag to provide additional descriptive information.
```

**Agent's note:** You're on the right track that attributes provide additional information, but your wording is a bit vague. Think about what an attribute actually is in the syntax of an HTML tag—what does it look like, and how is it connected to the tag itself?

## 25. arrays · a-12055

**Question:** What is an off-by-one error?

**Reference:** (none)

**Learner answer:**

```
Trying to access an index that doesn't exist. Indexes begin at 0, not 1.
```

**Agent's note:** You've got the zero-based indexing right, but an off-by-one error is more specific than just accessing a nonexistent index—it's when your loop or calculation is off by exactly one, usually because you miscounted. What's the difference between `i <= someArray.length` and `i < someArray.length`?

## 26. html · a-5752

**Question:** What happens if you don't close an HTML tag?

**Reference:** (none)

**Learner answer:**

```
You get an error that might not display on the page
```

**Agent's note:** Not quite—browsers are actually pretty forgiving with unclosed tags. What you said suggests something breaks, but the browser has ways of handling it. Think about what the browser might do to recover when it encounters an unclosed tag.

## 27. arrays · a-12820

**Question:** How do you read an element from the start of an array without removing it?

**Reference:** (none)

**Learner answer:**

```
Using console.log and searching by the index number of 0 since arrays are zero-based. 
```

**Agent's note:** You've got the right index, but `console.log` is for printing—that's not reading an element into a variable so you can use it. What syntax would you use to access an array element by its index?

## 28. html · a-5995

**Question:** What is an HTML tag?

**Reference:** (none)

**Learner answer:**

```
A tag is a way to mark a document with HTML so that it can be displayed in a browser. There are numerous tag possibilities that can be used based off what you are trying to accomplish with the particular content that you are using the tag on. 
```

**Agent's note:** You're right that tags mark content and there are different ones for different purposes. But what actually *is* a tag—what are its parts? Look at the anatomy diagram in the lesson.

## 29. arrays · a-12054

**Question:** What is an array index?

**Reference:** (none)

**Learner answer:**

```
All of the items that are stored in an array.
```

**Agent's note:** You're describing the elements of an array, not the index itself. What is an index in terms of what it represents or what you use it for?

## 30. html · a-3108

**Question:** What happens if you don't close an HTML tag?

**Reference:** (none)

**Learner answer:**

```
Some browsers could fix the error, however some won't and you can't guarantee your element will work properly
```

**Agent's note:** You're touching on something real—browsers do try to be forgiving—but the lesson is asking about what *happens*, not whether it might work anyway. What does the unclosed tag actually do to the page?
