import { useEffect, useState } from "react";
import { fetchItems, submitVote } from "./lib/api";
import type { VoteItem } from "./types";
import "./App.css";

function App() {
  const [items, setItems] = useState<VoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(
    () => window.localStorage.getItem("site-votacao:has-voted") === "true",
  );

  useEffect(() => {
    let active = true;

    async function loadItems() {
      try {
        const nextItems = await fetchItems();

        if (!active) {
          return;
        }

        setItems(nextItems);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os votos.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      active = false;
    };
  }, []);

  async function handleVote(itemId: string) {
    setBusyItemId(itemId);
    setError(null);

    try {
      const result = await submitVote(itemId);

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === result.itemId
            ? { ...item, voteCount: result.totalVotes }
            : item,
        ),
      );

      setHasVoted(true);
      window.localStorage.setItem("site-votacao:has-voted", "true");
      window.localStorage.setItem("site-votacao:last-voted-item", itemId);
    } catch (voteError) {
      setError(
        voteError instanceof Error
          ? voteError.message
          : "Não foi possível registar o voto.",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  const totalVotes = items.reduce((sum, item) => sum + item.voteCount, 0);

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="eyebrow">Website de votações</div>
        <h1>Escolhe o teu favorito e vota em segundos.</h1>
        <p>
          O Google Sheets guarda os votos, as funções aplicam anti-spam e o site
          fica aberto para qualquer pessoa votar uma vez.
        </p>

        <div className="hero-stats" aria-label="Resumo da votação">
          <article>
            <strong>{items.length || 28}</strong>
            <span>Cards ativos</span>
          </article>
          <article>
            <strong>{totalVotes}</strong>
            <span>Total de votos</span>
          </article>
          <article>
            <strong>1</strong>
            <span>Voto por browser</span>
          </article>
        </div>
      </section>

      {hasVoted ? (
        <div className="status-banner">
          Já registaste o teu voto neste browser.
        </div>
      ) : null}

      {error ? <div className="status-banner">{error}</div> : null}

      {loading ? (
        <section className="loading-state">A carregar os 28 cards...</section>
      ) : (
        <section className="grid" aria-label="Lista de votos">
          {items.map((item) => (
            <article key={item.id} className="vote-card">
              <div className="media-frame">
                {item.mediaType === "video" ? (
                  <video
                    className="media"
                    src={item.mediaUrl}
                    poster={item.posterUrl}
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                ) : (
                  <img className="media" src={item.mediaUrl} alt={item.title} />
                )}
              </div>

              <div className="card-copy">
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>

                <div className="card-meta">
                  <span>{item.voteCount} votos</span>
                  <span>{item.mediaType === "video" ? "Vídeo" : "Imagem"}</span>
                </div>
              </div>

              <button
                type="button"
                className="vote-button"
                onClick={() => void handleVote(item.id)}
                disabled={busyItemId === item.id || hasVoted}
              >
                {busyItemId === item.id
                  ? "A votar..."
                  : hasVoted
                    ? "Já votaste"
                    : "Vote"}
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default App;
