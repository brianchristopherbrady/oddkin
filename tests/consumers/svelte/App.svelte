<script>
  let result = $state('');
  let typed = $state('');
  function submit(event) {
    event.preventDefault();
    result = JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)));
  }
</script>

<main class="odd-stack">
  <odd-card>
    <h1 slot="header">Sign up</h1>
    <form id="signup" class="odd-stack" onsubmit={submit}>
      <odd-input
        name="email"
        label="Email"
        type="email"
        required
        oninput={(event) => (typed = event.currentTarget.value)}
      ></odd-input>
      <odd-checkbox name="updates" value="yes">Send me updates</odd-checkbox>
      <odd-button type="submit" appearance="primary">Join</odd-button>
    </form>
    <p id="typed">{typed}</p>
    <output id="result">{result}</output>
  </odd-card>
</main>
