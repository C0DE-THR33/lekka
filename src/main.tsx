import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Counter } from './counter/Counter'
import { usingMock } from './lib/db'
import { setLang, useLang, useT } from './lib/i18n'
import { Owner } from './owner/Owner'
import { Simulate } from './owner/Today'
import './style.css'

const SHOP_NAME = 'Rows Kitchen'

const APPS = ['counter', 'owner', 'demo'] as const
type AppName = (typeof APPS)[number]

const appFromHash = (): AppName | null => APPS.find(a => location.hash === `#/${a}`) ?? null

/** Both apps on one screen, for a projector: each runs in its own frame, like two phones. */
function Demo() {
  const t = useT()
  return (
    <div className="stage">
      {(['counter', 'owner'] as const).map(app => (
        <figure key={app} className="phone">
          <figcaption className="label">{t(`${app}App`)}</figcaption>
          <iframe src={`${location.pathname}${location.search}#/${app}`} title={t(`${app}App`)} />
        </figure>
      ))}
      <Simulate />
    </div>
  )
}

/** Shows the other language, written in that language. */
function LangToggle() {
  const lang = useLang()
  const other = lang === 'en' ? 'kn' : 'en'
  return (
    <button className="link" lang={other} onClick={() => setLang(other)}>
      {other === 'kn' ? 'ಕನ್ನಡ' : 'English'}
    </button>
  )
}

function App() {
  const t = useT()
  const [app, setApp] = useState(appFromHash)

  useEffect(() => {
    const onHash = () => setApp(appFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      {usingMock && self === top && <p className="note">{t('demoNote')}</p>}
      <header className={app ?? undefined}>
        <span><a className="home" href="#/"><strong>{SHOP_NAME}</strong></a>{app && ` · ${t(app)}`}</span>
        <LangToggle />
      </header>
      <main className={app ?? undefined}>
        {app === 'owner' && <Owner />}
        {app === 'counter' && <Counter />}
        {app === 'demo' && <Demo />}
        {!app && (
          <section className="landing">
            <h1>{t('appName')}</h1>
            <p className="lede">{t('pitch')}</p>
            <a className="big primary" href="#/demo">{t('liveDemo')}<small>{t('liveDemoHint')}</small></a>
            <a className="big" href="#/counter">{t('counterApp')}<small>{t('counterAppHint')}</small></a>
            <a className="big" href="#/owner">{t('ownerApp')}<small>{t('ownerAppHint')}</small></a>
            <p className="muted">{t('simulatedNote')}</p>
          </section>
        )}
      </main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
