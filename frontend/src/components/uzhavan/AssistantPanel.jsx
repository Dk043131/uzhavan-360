import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { History, Mic, MicOff, Plus, Sparkles, Sprout, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useInvalidateCommerce } from "@/hooks/queries";
import { uzhavanApi } from "@/lib/api";
import { useSpeech } from "./useSpeech";

const CONV_KEY = "uzhavan_conversation_id";
const LANG_STORAGE_KEY = "uzhavan_language";

const CHIPS_BY_LANG = {
  ta: {
    ROLE_FARMER: ["🌾 என் விளைபொருட்கள்", "📦 வாங்குபவர் கோரிக்கைகள்", "📈 தக்காளி சந்தை தேவை", "💰 எனது ஆர்டர்கள்"],
    ROLE_BUYER: ["🍅 தக்காளி தேடுங்கள்", "📦 எனது ஆர்டர்கள்", "🌱 புதிய விளைபொருட்கள்"],
    ROLE_ADMIN: ["🔍 கோயம்புத்தூர் சந்தை", "📊 தேவை சிக்னல்கள்"]
  },
  tanglish: {
    ROLE_FARMER: ["🌾 En produce kaatu", "📦 Buyer requests enna?", "📈 Tomato demand evlo?", "💰 My orders status"],
    ROLE_BUYER: ["🍅 Tomatoes near me", "📦 My orders kaatu", "🌱 Fresh crops"],
    ROLE_ADMIN: ["🔍 Coimbatore produce", "📊 Demand signals"]
  },
  en: {
    ROLE_FARMER: ["🌾 Show my produce", "📦 Incoming requests", "📈 Tomato demand?", "💰 My orders"],
    ROLE_BUYER: ["🍅 Find tomatoes near me", "📦 Show my orders", "🌱 Fresh produce"],
    ROLE_ADMIN: ["🔍 Search near Coimbatore", "📊 Show demand signals"]
  }
};

const PLACEHOLDERS = {
  ta: "ரூட்-யிடம் கேளுங்கள்... (எ.கா. தக்காளி விலை என்ன?)",
  tanglish: "ROOT-kitta kelunga... (e.g. Tomato demand evlo?)",
  en: "Ask ROOT anything about your farm..."
};

const MUTATING = new Set([
  "createProduct", "updateProduct", "deleteProduct", "addHarvest",
  "recordOffPlatformSale", "submitRequest", "cancelRequest", "acceptRequest",
  "rejectRequest", "confirmQuantity", "completeOrder", "markNoShow", "listByproduct"
]);

/**
 * Rich message formatter: cleans raw asterisks, formats bold, bullet lists, and paragraphs.
 */
function FormattedText({ content }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements = [];
  let currentList = [];

  const parseInline = (str) => {
    const parts = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="chat-strong">{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="chat-list">
          {currentList.map((item, idx) => (
            <li key={idx} className="chat-list-item">{parseInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const listMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (listMatch) {
      currentList.push(listMatch[1]);
      return;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      elements.push(<h4 key={index} className="chat-heading">{parseInline(trimmed.slice(4))}</h4>);
    } else {
      elements.push(<p key={index} className="chat-para">{parseInline(trimmed)}</p>);
    }
  });

  flushList();
  return <div className="formatted-message">{elements}</div>;
}

export function AssistantPanel({ open, onClose }) {
  const { user } = useAuth();
  const invalidate = useInvalidateCommerce();
  const status = useQuery({ queryKey: ["uzhavan-status"], queryFn: uzhavanApi.status, enabled: open, staleTime: 60000 });
  const [conversationId, setConversationId] = useState(() => sessionStorage.getItem(CONV_KEY) || undefined);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState(() => localStorage.getItem(LANG_STORAGE_KEY) || "ta");
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef(null);
  const speech = useSpeech({ language, onResult: (t) => setText(t) });

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch (_) {}
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, speech.listening, speech.transcribing]);

  useEffect(() => {
    if (!open || !conversationId || messages.length) return;
    uzhavanApi.conversation(conversationId)
      .then((c) => setMessages(c.messages.map((m) => ({
        from: m.role === "user" ? "user" : "bot",
        text: m.content,
        toolResult: m.toolResult,
        toolCalled: m.toolCalls?.[0]?.name
      }))))
      .catch(() => {
        sessionStorage.removeItem(CONV_KEY);
        setConversationId(undefined);
      });
  }, [open, conversationId, messages.length]);

  const push = (m) => setMessages((prev) => [...prev, m]);

  const handleResult = (result) => {
    if (result.conversationId && result.conversationId !== conversationId) {
      setConversationId(result.conversationId);
      sessionStorage.setItem(CONV_KEY, result.conversationId);
    }
    const failed = Boolean(result.error) || ["GEMINI_ERROR", "GROQ_ERROR", "AI_UNAVAILABLE"].includes(result.intent);
    push({
      from: "bot",
      text: result.response,
      error: failed,
      toolCalled: result.toolCalled,
      toolResult: result.toolResult,
      confirmation: result.requiresConfirmation ? { toolName: result.toolName, params: result.params } : null,
      intent: result.intent
    });
    if (result.toolCalled && MUTATING.has(result.toolCalled) && !result.error) {
      invalidate();
      // Auto-switch marketplace location to the new produce's district so it appears immediately!
      if (result.toolCalled === "createProduct" && result.toolResult?.location?.coordinates) {
        const [lng, lat] = result.toolResult.location.coordinates;
        const district = result.toolResult.address?.district || result.toolResult.address?.city || "Salem";
        const newLoc = { name: district, lat, lng };
        try {
          localStorage.setItem("uzhavan_location_v2", JSON.stringify(newLoc));
          window.dispatchEvent(new CustomEvent("uzhavan:locationChange", { detail: newLoc }));
        } catch (_) {}
      }
    }
    if (speak && result.response) speech.say(result.response);
  };

  const send = async (value) => {
    const t = (value ?? text).trim();
    if (!t || busy) return;
    setText("");
    push({ from: "user", text: t });
    setBusy(true);
    try {
      handleResult(await uzhavanApi.message({ text: t, language, conversationId }));
    } catch (err) {
      push({ from: "bot", text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const confirmTool = async (msg, yes) => {
    setMessages((prev) => prev.map((m) => (m === msg ? { ...m, confirmation: { ...m.confirmation, resolved: yes ? "confirmed" : "cancelled" } } : m)));
    await send(yes ? "yes" : "no");
  };

  const newConversation = () => {
    sessionStorage.removeItem(CONV_KEY);
    setConversationId(undefined);
    setMessages([]);
    setShowHistory(false);
  };

  const loadConversation = async (id) => {
    setShowHistory(false);
    setMessages([]);
    sessionStorage.setItem(CONV_KEY, id);
    setConversationId(id);
  };

  if (!open) return null;
  const aiOff = status.data && !status.data.aiConfigured;
  const currentChips = (CHIPS_BY_LANG[language] || CHIPS_BY_LANG.en)[user?.role] || (CHIPS_BY_LANG[language] || CHIPS_BY_LANG.en).ROLE_BUYER;

  return (
    <div className="assistant-panel" role="dialog" aria-label="Ask ROOT" data-testid="ask-uzhavan-panel">
      {/* Header */}
      <div className="assistant-head">
        <div>
          <span className="eyebrow">Your farm companion</span>
          <h2><Sparkles size={18} style={{ color: "var(--amber)" }} /> Ask ROOT</h2>
        </div>
        <button onClick={onClose} className="close-button" aria-label="Close" data-testid="close-ask-uzhavan-button">
          <X size={18} />
        </button>
      </div>

      {/* Language Switcher & Actions Toolbar */}
      <div className="assistant-toolbar-box">
        {/* Segmented Language Controls */}
        <div className="lang-segmented" role="radiogroup" aria-label="Language options">
          <button
            type="button"
            className={`lang-tab ${language === "ta" ? "active" : ""}`}
            onClick={() => handleLanguageChange("ta")}
          >
            🇮🇳 தமிழ்
          </button>
          <button
            type="button"
            className={`lang-tab ${language === "tanglish" ? "active" : ""}`}
            onClick={() => handleLanguageChange("tanglish")}
          >
            🗣️ Tanglish
          </button>
          <button
            type="button"
            className={`lang-tab ${language === "en" ? "active" : ""}`}
            onClick={() => handleLanguageChange("en")}
          >
            🇬🇧 English
          </button>
        </div>

        {/* Hidden select for automated test-id compatibility */}
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          style={{ display: "none" }}
          aria-label="Language"
          data-testid="assistant-language-select"
        >
          <option value="ta">தமிழ்</option>
          <option value="tanglish">Tanglish</option>
          <option value="en">English</option>
        </select>

        {/* Actions Row */}
        <div className="assistant-actions-row">
          <button className="ghost-button" onClick={newConversation} data-testid="assistant-new-conversation">
            <Plus size={13} /> New chat
          </button>
          <button className="ghost-button" onClick={() => setShowHistory(!showHistory)} data-testid="assistant-history-button">
            <History size={13} /> History
          </button>
          {speech.ttsSupported && (
            <button
              className={`ghost-button ${speak ? "active" : ""}`}
              aria-pressed={speak}
              onClick={() => setSpeak(!speak)}
              data-testid="assistant-speak-toggle"
            >
              {speak ? <Volume2 size={13} /> : <VolumeX size={13} />} Voice replies
            </button>
          )}
        </div>
      </div>

      {aiOff && (
        <div className="bubble system-bubble" style={{ margin: "10px 16px 0" }} data-testid="assistant-ai-unconfigured">
          ROOT AI is not activated on the server (GROQ_API_KEY missing). Messages will get a fallback reply until it is configured.
        </div>
      )}

      {showHistory && <ConversationList onPick={loadConversation} current={conversationId} />}

      {/* Messages Feed */}
      <div className="assistant-messages" ref={listRef} aria-live="polite">
        {!messages.length && (
          <div className="assistant-welcome">
            <div className="assistant-icon"><Sprout size={24} /></div>
            <h3>
              {language === "ta" ? "விவசாய உதவி தேவையா?" : language === "tanglish" ? "Enna doubt irukku?" : "What’s on your mind?"}
            </h3>
            <p>
              {language === "ta"
                ? "தமிழில் பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள். விளைபொருட்கள், சந்தை விலை, ஆர்டர்கள் பற்றி ROOT-யிடம் கேளுங்கள்."
                : language === "tanglish"
                ? "Tanglish-la kelunga or type pannunga. Produce, price, orders pathi ROOT help pannum."
                : "Ask in English, Tamil or Tanglish. ROOT can look up produce, prices, orders, and act on your behalf."}
            </p>
            <div className="quick-chips">
              {currentChips.map((c, i) => (
                <button key={c} onClick={() => send(c)} data-testid={`assistant-quick-chip-${i}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} m={m} index={i} onConfirm={confirmTool} onClose={onClose} />
        ))}

        {busy && <div className="bubble bot-bubble" data-testid="assistant-thinking">ROOT is thinking…</div>}
      </div>

      {/* Input Area with Live Tamil/English STT Status */}
      <div className="assistant-input-box">
        {speech.listening && (
          <div className="listening-banner" data-testid="assistant-listening-indicator">
            <span className="pulsing-dot" />
            <span>
              {language === "ta"
                ? "🎙️ தமிழில் பேசலாம்... உழவன் கேட்கிறது"
                : language === "tanglish"
                ? "🎙️ Tanglish-la pesunga... Listening"
                : "🎙️ Listening in English... Speak now"}
            </span>
          </div>
        )}

        {speech.transcribing && (
          <div className="listening-banner transcribing-banner" data-testid="assistant-transcribing-indicator">
            <span className="pulsing-dot" style={{ background: "#2563eb" }} />
            <span>
              {language === "ta"
                ? "✨ தமிழில் மாற்றுகிறது (Transcribing)..."
                : "✨ Transcribing with Groq Whisper..."}
            </span>
          </div>
        )}

        <form className="assistant-input-inner" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {speech.sttSupported && (
            <button
              type="button"
              className={`mic-button ${speech.listening ? "listening" : ""}`}
              onClick={speech.listening ? speech.stop : speech.start}
              aria-label={speech.listening ? "Stop listening" : "Speak in " + (language === "ta" ? "Tamil" : language === "tanglish" ? "Tanglish" : "English")}
              title={language === "ta" ? "தமிழில் பேச கிளிக் செய்யவும்" : "Click to speak"}
              data-testid="assistant-mic-button"
            >
              {speech.listening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={speech.listening ? (language === "ta" ? "கேட்கிறது..." : "Listening…") : (PLACEHOLDERS[language] || PLACEHOLDERS.en)}
            aria-label="Message"
            data-testid="assistant-input"
          />
          <button className="send-button" disabled={busy || !text.trim()} data-testid="assistant-send-button">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ m, index, onConfirm, onClose }) {
  if (m.from === "user") {
    return <div className="bubble user-bubble" data-testid={`assistant-message-${index}`}>{m.text}</div>;
  }
  return (
    <div className={`bubble bot-bubble ${m.error ? "error-bubble" : ""}`} data-testid={`assistant-message-${index}`}>
      <FormattedText content={m.text} />
      {m.confirmation && (
        <div className="confirm-card" data-testid={`assistant-confirmation-${index}`}>
          <h4>Confirm action: {m.confirmation.toolName}</h4>
          {m.confirmation.params && Object.keys(m.confirmation.params).length > 0 && <pre>{JSON.stringify(m.confirmation.params, null, 1)}</pre>}
          {m.confirmation.resolved ? <span className="muted">{m.confirmation.resolved === "confirmed" ? "You confirmed." : "You cancelled."}</span> : <div className="dialog-actions"><button className="primary-button compact" onClick={() => onConfirm(m, true)} data-testid={`assistant-confirm-yes-${index}`}>Yes, proceed</button><button className="ghost-button" onClick={() => onConfirm(m, false)} data-testid={`assistant-confirm-no-${index}`}>No, cancel</button></div>}
        </div>
      )}
      {m.toolResult !== undefined && m.toolResult !== null && <ToolResult name={m.toolCalled} result={m.toolResult} onClose={onClose} />}
    </div>
  );
}

function ToolResult({ name, result, onClose }) {
  const items = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : Array.isArray(result?.matches) ? result.matches : Array.isArray(result?.products) ? result.products : null;
  const single = result?.product || result?.order || result?.request || (result?._id ? result : null);

  const isCreatedProduct = (name === "createProduct" || (single && single.availableStock !== undefined && single.pricePerUnit !== undefined && single._id));

  return (
    <div className="tool-result-wrap" style={{ marginTop: "8px" }}>
      {isCreatedProduct && single && (
        <div className="produce-live-card" data-testid="assistant-created-product-card" style={{
          padding: "12px 14px",
          borderRadius: "8px",
          background: "var(--card, #ffffff)",
          border: "1.5px solid #22c55e",
          boxShadow: "0 2px 8px rgba(34, 197, 94, 0.15)",
          marginBottom: "8px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#166534", display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Live on Uzhavan Marketplace
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>{single.category || "Produce"}</span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text, #111827)", marginBottom: "2px" }}>
            {single.name} · {single.totalStock ?? single.availableStock} {single.unit || "KG"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "10px" }}>
            ₹{single.pricePerUnit}/{single.unit || "kg"} · {single.address?.district || single.address?.city || "Salem"}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link to="/" onClick={onClose} className="primary-button compact" style={{ textDecoration: "none", fontSize: "12px", padding: "6px 12px" }}>
              🛒 View on Marketplace
            </Link>
            <Link to="/farmer/products" onClick={onClose} className="ghost-button compact" style={{ textDecoration: "none", fontSize: "12px", padding: "6px 12px" }}>
              🌾 Farm Workspace
            </Link>
            <Link to={`/product/${single._id}`} onClick={onClose} className="ghost-button compact" style={{ textDecoration: "none", fontSize: "12px", padding: "6px 12px" }}>
              🔍 Produce Details
            </Link>
          </div>
        </div>
      )}

      <details className="tool-result" data-testid="assistant-tool-result">
        <summary>Marketplace Data Details{name ? ` · ${name}` : ""}{items ? ` (${items.length})` : ""}</summary>
        {items && items.length > 0 && <ul style={{ margin: 0, paddingLeft: 16 }}>{items.slice(0, 8).map((it, i) => <li key={it._id || it.productId || i}>{it.name || it.productId?.name || it.title || it.status || JSON.stringify(it).slice(0, 80)}{it.pricePerUnit ? ` · ₹${it.pricePerUnit}/${String(it.unit || "kg").toLowerCase()}` : ""}{typeof it.availableStock === "number" ? ` · ${it.availableStock} available` : ""}{it.status && it.name ? ` · ${it.status}` : ""}{(it._id || it.productId) && (it.pricePerUnit !== undefined) && <> · <Link to={`/product/${it._id || it.productId}`} onClick={onClose}>open</Link></>}</li>)}</ul>}
        {items && items.length === 0 && <span className="muted">Nothing found.</span>}
        {!items && single && <div>{single.name && <strong>{single.name}</strong>}{single.status && <span> · {single.status}</span>}{typeof single.availableStock === "number" && <span> · {single.availableStock} {String(single.unit || "").toLowerCase()} available</span>}{typeof single.totalAmount === "number" && <span> · ₹{single.totalAmount}</span>}</div>}
        {!items && !single && <pre>{JSON.stringify(result, null, 1).slice(0, 1500)}</pre>}
      </details>
    </div>
  );
}

function ConversationList({ onPick, current }) {
  const q = useQuery({ queryKey: ["uzhavan-conversations"], queryFn: uzhavanApi.conversations });
  return (
    <div className="tool-result" style={{ margin: "8px 18px 0" }} data-testid="assistant-conversations">
      {q.isLoading && <span className="muted">Loading conversations…</span>}
      {q.isError && <span className="muted">{q.error.message}</span>}
      {q.data && q.data.length === 0 && <span className="muted">No previous conversations.</span>}
      {q.data && q.data.map((c) => <button key={c.conversationId} className="link-button" style={{ textAlign: "left" }} onClick={() => onPick(c.conversationId)} data-testid={`assistant-conversation-${c.conversationId}`}>{c.conversationId === current ? "● " : ""}{c.messages?.[0]?.content?.slice(0, 50) || c.conversationId} · {c.messages?.length || 0} msgs</button>)}
    </div>
  );
}
