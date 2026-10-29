/** Fragment przykladowej umowy z zaznaczeniami - pokazuje na starcie, co robi aplikacja. */
export function SampleSheet() {
  return (
    <figure className="hero-sample">
      <div
        className="sheet sheet-tilted"
        aria-label="Przykład: fragment umowy z zaznaczonymi danymi"
      >
        <p className="sheet-title">Umowa serwisowa nr 7/2026</p>
        <p>
          Zawarta w Poznaniu dnia <mark className="hl-date">2 listopada 2026 r.</mark> pomiędzy{' '}
          <mark className="hl-party">Alfa Serwis sp. z o.o.</mark> a{' '}
          <mark className="hl-party">Pracownią Delta S.A.</mark>, reprezentowaną przez{' '}
          <mark className="hl-party">Martę Wiśniewską</mark>.
        </p>
        <p>
          Za obsługę serwisową Zleceniodawca zapłaci{' '}
          <mark className="hl-amount">4 800,00 zł netto</mark> miesięcznie, począwszy od{' '}
          <mark className="hl-date">1 grudnia 2026 r.</mark>
        </p>
      </div>
      <pre className="json-peek" aria-label="Fragment wyniku w formacie JSON">
        <span className="json-comment">{'// z tego fragmentu powstaje m.in.:'}</span>
        {'\n"date": '}
        <b className="hl-date">"2026-11-02"</b>
        {',\n"people": ['}
        <b className="hl-party">"Marta Wiśniewska"</b>
        {'],\n"amounts": [{ "value": '}
        <b className="hl-amount">4800</b>
        {', "currency": "PLN" }]'}
      </pre>
      <figcaption className="legend">
        <span className="legend-amount">kwoty</span>
        <span className="legend-date">daty</span>
        <span className="legend-party">strony i osoby</span>
      </figcaption>
    </figure>
  )
}
