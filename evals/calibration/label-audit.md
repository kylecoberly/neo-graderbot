# Label audit: where a second grader disagrees with the 2022 verdict

anthropic:claude-opus-5 graded the 120 core answers blind and disagreed on 19. For each one below, decide whether the 2022 verdict was wrong, and set `concede` in label-audit.json: `true` if the second grader has it right, `false` if the 2022 verdict stands. Then `pnpm audit:labels` prints the instructor's error rate.

## a-10344 (arrays)

**Question:** **Describe JavaScript arrays in your own words**

**Answer:** A stored list of objects

false

**2022 verdict:** reject. **Second grader:** accept (medium).

> The lesson's core claim is simply that "arrays store collections of related items," and the learner's "a stored list of objects" conveys that same mental model (a single list holding multiple things) despite being terse. The word "objects" is loose given that JS objects are a distinct type and array elements are often strings/numbers, but nothing in the answer is actively false and the passages don't contrast arrays with objects. It omits indexing/length, yet the question only asked for a description.

## a-8667 (arrays)

**Question:** **Given this array:**

```js
const fruits = ["Apple", "Banana", "Carrot"]
```

How would you print the "Carrot" element?

**Answer:** console.log(someArray[2])

reject

**2022 verdict:** reject. **Second grader:** accept (high).

> The learner correctly identifies zero-based indexing and uses index 2 with console.log, which is exactly the lesson's point. The only flaw is naming the array `someArray` instead of `fruits`, a trivial slip that doesn't indicate a wrong mental model.

## a-10689 (arrays)

**Question:** **How do you tell how many elements are in an array?**

**Answer:** using the .list method will allow us to determine how many items are contained within an array. It is important to note that this length sum will NOT be a 0 start, that is to say the length will start with 1 not 0.

reject

**2022 verdict:** reject. **Second grader:** accept (medium).

> The learner writes ".list" which is not a real property, but immediately refers to "this length sum," so it reads as a slip rather than a wrong mental model; they correctly state that length counts items starting at 1, not zero-based, which is the key point from passage [2]. Calling it a "method" rather than a property is loose but not contradicted by the lesson's phrasing. The underlying understanding is right.

## a-11516 (arrays)

**Question:** **How do you read an element from the start of an array without removing it?**

**Answer:** ```js
> arrayName.at(0)
> ```

accept

**2022 verdict:** reject. **Second grader:** accept (medium).

> The question targets non-destructive access by index (vs. `.shift`), and `.at(0)` is a valid JS method that returns the first element without mutating the array — the same mental model as `arrayName[0]`. The lesson only shows bracket indexing, but using `.at` isn't wrong and doesn't teach anything false.

## a-11003 (arrays)

**Question:** **How do you read an element from the end of an array of unknown length without removing it?**

**Answer:** In a two step process; You would first determine the length of the array using .length, then you would then use the console.log(someArray[x]) where x is the index position of the last element in the array 

accept

**2022 verdict:** accept. **Second grader:** reject (medium).

> The learner correctly identifies that you read without removing by bracket-indexing (rather than `.pop`) and that `.length` is involved, but the whole point of the question — that the last index is `length - 1` — is left circular ('x is the index position of the last element'). Given the lesson explicitly flags off-by-one errors as the hazard here, the answer dodges the one computation being tested.

## a-10747 (arrays)

**Question:** **How do you read an element from the end of an array of unknown length without removing it?**

**Answer:** ```js
> const i = someArray.length()
> someArray[i-1]
> ```

reject

**2022 verdict:** reject. **Second grader:** accept (medium).

> The core mental model is correct: the last element is at index length - 1 and bracket access reads without mutating, which is exactly what the question targets (as opposed to `.pop`). The slip is writing `.length()` as a method call when the lesson shows `someArray.length` as a property 
inconsistent with the lesson and would actually throw, but it reads as a syntax slip rather than a misunderstanding of the concept being tested.

## a-10035 (arrays)

**Question:** **How do you read an element from the start of an array without removing it?**

**Answer:** .index[0]

reject

**2022 verdict:** accept. **Second grader:** reject (medium).

> The correct approach is bracket notation on the array itself, e.g. `myArray[0]`, which reads without mutating. The learner's `.index[0]` invents a non-existent `index` property and is not valid JavaScript; while it hints they know position 0 matters, the syntax as written would mislead and doesn't demonstrate the access pattern correctly.

## a-11360 (arrays)

**Question:** **What is spreading an array? Why would you use it?**

**Answer:** It allows you to add to an existing array. Used when all of the items from an array need to be used for another list. 

reject

**2022 verdict:** accept. **Second grader:** reject (medium).

> The lesson frames spreading specifically as the non-mutating alternative to push/unshift "that preserves the original array," and the learner's answer never mentions that; worse, saying it "allows you to add to an existing array" describes what spread does *not* do and could teach the learner that it mutates the original. The second sentence shows a vague grasp that the items get copied into another list, but the core reason the lesson gives is missing.

## a-10352 (arrays)

**Question:** **How do you remove an element from the start of an array?**

**Answer:** use Shift

reject

**2022 verdict:** reject. **Second grader:** accept (high).

> The lesson defines `.shift` as removing an element from the beginning of an array, which is exactly what the learner says, though stated very tersely. Capitalization is a trivial issue, not a conceptual error.

## a-9757 (arrays)

**Question:** **Convert these variables to an array:**

```js
const user1 = "Pat"
const user2 = "Enrique"
const user3 = "Dominique"
```

**Answer:** 
> ```js
> const nameArray = ["Pat, "Enrique", "Dominique"]
> ```
> 

reject

**2022 verdict:** reject. **Second grader:** accept (medium).

> The learner correctly collapses the three separate variables into a single array of strings, which is exactly the mental model the lesson is teaching. The only flaw is a missing closing quote after "Pat, a transcription typo rather than a conceptual error, and nothing about it would teach a false idea about arrays.

## a-11357 (arrays)

**Question:** **How do you read an element from the end of an array of unknown length without removing it?**

**Answer:** You can use .length() to find how many items are in the list then use that last index number to call item. 

reject

**2022 verdict:** reject. **Second grader:** accept (medium).

> The learner identifies the right approach: use the array's length to compute the final index and read the element by index rather than using .pop, which is the core of the question (read without removing). Minor flaws a writing `.length()` as if it were a method and not spelling out `length - 1` a are notation/incompleteness issues; saying "that last index number" avoids actually asserting the off-by-one mistake.

## a-5420 (html)

**Question:** **What are the required elements in the `<head>` tag?**

**Answer:** The meta charset tag is also required.
> 
> ```html
> <meta charset="utf-8">
> ```

reject

**2022 verdict:** accept. **Second grader:** reject (medium).

> The lesson lists two required children of `<head>`: `<title>` and `<meta charset="utf-8" />`. The learner names only the meta charset tag and omits `<title>`, so half of the answer the question asks for is missing; nothing stated is false, but the response is incomplete on the exact point being tested.

## a-3384 (html)

**Question:** **What are the required elements in the `<head>` tag?**

**Answer:** there are no REQUIRED elements, but essential minimums should include meta charset and title

Reject

**2022 verdict:** reject. **Second grader:** accept (medium).

> The learner correctly identifies both elements the lesson lists inside `<head>`: `<title>` and `<meta charset="utf-8" />`, which is what the question is actually asking. The opening quip that "there are no REQUIRED elements" conflicts with the lesson's wording (it explicitly calls charset "a required element of the page"), but it echoes passage [2] on browsers silently correcting omissions and is immediately walked back by naming the minimums, so the mental model is right rather than false.

## a-5999 (html)

**Question:** **What is an HTML doctype?**

**Answer:** HTML doctype is the statement that declares the file to be an HMTL Document. It is used at the beginning of each HMTL document. 
accept

**2022 verdict:** reject. **Second grader:** accept (medium).

> The lesson says `<!doctype html>` declares the document is written in HTML5 rather than a previous version; the learner captures that it declares the file as an HTML document and appears at the top. The answer omits the HTML5-versioning nuance but the core mental model (a declaration of document type at the start of the file) is correct, and the typos (HMTL) are harmless.

## a-2376 (html)

**Question:** **What is the `lang` attribute used for in HTML?**

**Answer:** To specify the language the doc is written in
accept

**2022 verdict:** reject. **Second grader:** accept (high).

> The lesson states `<html lang="en">` indicates the language of the content; the learner's answer matches that exactly, if tersely.

## a-4953 (html)

**Question:** **What is an HTML tag?**

**Answer:** The beginning of a directive provided by the user to instruct the browser how content should be viewed. 
reject

**2022 verdict:** accept. **Second grader:** reject (medium).

> The lesson frames a tag as a named markup unit (name + attributes, usually an opening/closing pair) that wraps and describes the meaning of content; the learner instead defines it as 'the beginning of a directive' telling the browser 'how content should be viewed,' which conflates HTML with presentation/styling and omits the wrapping/semantic role. Calling it only the 'beginning' also ignores closing and self-closing tags. This wording would teach a false model of what HTML markup does.

## a-4960 (html)

**Question:** **What happens if you don't close an HTML tag?**

**Answer:** The tag will not function. 
reject

**2022 verdict:** accept. **Second grader:** reject (medium).

> The expected idea is that an unclosed tag makes the document structure ambiguous 
invalid markup 
where the browser guesses, typically swallowing subsequent content into the open element and producing unpredictable rendering/debugging pain (per the style passage about hard-to-spot unclosed tags). "The tag will not function" is both vague and inaccurate: browsers don't simply ignore the tag; it usually still applies, often to far more content than intended.

## a-5752 (html)

**Question:** **What happens if you don't close an HTML tag?**

**Answer:** You get an error that might not display on the page
reject

**2022 verdict:** accept. **Second grader:** reject (medium).

> The lesson's point is that unclosed tags fail silently 
content gets swallowed into the open element and the page renders in unexpected ways, with nothing flagging the mistake (hence the formatting advice to make it noticeable). The learner's answer asserts "you get an error," which misstates HTML's error-tolerant behavior, and the trailing "might not display on the page" is too vague to show the key idea that the browser recovers silently and renders something wrong. It neither names the consequence nor correctly characterizes the failure mode.

## a-4440 (html)

**Question:** **What is a self-closing HTML tag?**

**Answer:** A tag that does not require a set of brackets. ie ``` <p> </p> ```

accept

**2022 verdict:** accept. **Second grader:** reject (high).

> The lesson defines a self-closing tag as one that has no separate closing tag and closes itself (e.g. `<img />`). The answer's phrasing ('does not require a set of brackets') is garbled, and the example given, `<p></p>`, is a paired opening/closing tag — the opposite of a self-closing tag — so it would teach the learner something false.
