Modern Cloze Overlapper for Anki
================================

This is a rewrite of anki-simple-cloze-overlapper__ in modern JS. For an overview of features,
please take a look at a `usage example`__ in that repository.

__ https://github.com/michalrus/anki-simple-cloze-overlapper
__ https://github.com/michalrus/anki-simple-cloze-overlapper/blob/main/screen-recording.gif

In addition to ``anki-simple-cloze-overlapper`` features, support was added for:

- Nested clozes.
- Clozes in MathJax.

It has been tested only on Anki Desktop. In principle, it should be usable on AnkiDroid, Anki Web
and Anki Mobile (but it hasn't been tested). If you want to test on Android, make sure you have
the latest `Android System WebView`__ installed.

__ https://play.google.com/store/apps/details?id=com.google.android.webview

How to Use
----------

#. Place the `<_cloze-overlapper.mjs>`_ into Anki's `collection.media folder`__.

   __ https://docs.ankiweb.net/media.html#manually-adding-media

#. Create a new note type by cloning the built-in Cloze.
#. Add a rendering configuration field named ``Before|After|OnlyContext|RevelAll|InactiveHints``.
#. Put the content of `<front.html>`_ into note's Front Template.
#. Put the content of `<back.html>`_ into note's Back Template.

Rendering Configuration
-----------------------

Template's field ``Before|After|OnlyContext|RevelAll|InactiveHints`` controls the rendering
of clozes. Individual parameters are separated by either spaces, commas, pipes or dots.
Omitted rightmost parameters all take default values.

The parameters are as follows:

``Before`` (non-negative integer, defaults to 1)
  The number of clozes before the currently active ones to uncover.

``After`` (non-negative integer, defaults to 0)
  The number of clozes after the currently active ones to uncover.

``OnlyContext`` (Boolean ``true`` or ``false``, defaults to ``false``)
  Show clozes only within the context (before + current + after).
  Set to ``true`` for e.g. long lyrics/poems.

``RevelAll`` (Boolean ``true`` or ``false``, defaults to ``false``)
  Reveal all clozes on the back of the card. By default only currently active clozes are revealed.
  (Context clozes are revealed even on cards' fronts.)

``InactiveHints`` (Boolean ``true`` or ``false``, defaults to ``false``)
  Use user-provided hints (i.e. ``{{c#::...::user provided hint}}``) for all clozes.
  By default, only the currently active clozes use provided hints, others use ``[...]``.

Context takes nesting of clozes into account: only clozes at the same level of nesting or above
can be considered before of after the current one. In the following example::

  {{c1::outer 1 {{c2::inner {{c3::deep 1}} {{c4::deep 2}} }} }} {{c5::outer 2}}

- ``c1``, ``c2`` and ``c3`` have no clozes before,
- ``c5`` has no clozes after,
- ``c3`` is before ``c4``, and similarly, ``c4`` is after ``c3``,
- ``c5`` is after ``c1``, ``c2`` and ``c4``, but only ``c1`` is before ``c5``.

Recall All Clozes Card
----------------------

If you need an extra card that asks you for all the clozes at once, add another cloze
with ``ask-all`` in its content, e.g. ``{{c99::ask-all}}``.

Reloading ``_cloze-overlapper.mjs``
-----------------------------------

JavaScript modules, such as ``_cloze-overlapper.mjs``, are loaded exactly once and never reloaded
(unless you restart Anki). However, you can use dummy query parameter too reload the module
without restarting Anki:

.. code:: javascript

  import { renderClozes } from '/_cloze-overlapper.mjs?dev=1';

``dev``-counter must be incremented after every modification of ``_cloze-overlapper.mjs``.
When the development is complete, ``dev`` query parameter can be removed and Anki restarted.
