// -- Constants ----------------------------------------------------------------

const SAMPLE_TTML = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word" xml:lang="en">
  <head>
    <metadata>
      <ttm:title>Sample Song</ttm:title>
      <ttm:agent type="person" xml:id="v1"><ttm:name type="full">Lead</ttm:name></ttm:agent>
      <ttm:agent type="person" xml:id="v2"><ttm:name type="full">Duet</ttm:name></ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:00.500" end="00:03.000" ttm:agent="v1"><span begin="00:00.500" end="00:01.000">First</span> <span begin="00:01.000" end="00:01.500">line</span> <span begin="00:01.500" end="00:02.000">with</span> <span begin="00:02.000" end="00:03.000">timing</span></p>
      <p begin="00:03.200" end="00:06.000" ttm:agent="v2"><span begin="00:03.200" end="00:04.000">Second</span> <span begin="00:04.000" end="00:05.000">voice</span><span ttm:role="x-bg"><span begin="00:05.000" end="00:06.000">(oh)</span></span></p>
    </div>
  </body>
</tt>`;

// -- Exports ------------------------------------------------------------------

export { SAMPLE_TTML };
