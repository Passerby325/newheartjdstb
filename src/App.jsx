import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get, remove } from "firebase/database";

// 🔥 Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyAxVvfLGQSfR5pnYxaTy2A_QHZ2NtJA_48",
  authDomain: "jiandaoshitoubu-20dfd.firebaseapp.com",
  databaseURL: "https://jiandaoshitoubu-20dfd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jiandaoshitoubu-20dfd",
  storageBucket: "jiandaoshitoubu-20dfd.firebasestorage.app",
  messagingSenderId: "911564599600",
  appId: "1:911564599600:web:0d0f4fda1cecdd8b4c18f5"
};

// 🔥 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function App() {
  // 基本游戏状态
  const [step, setStep] = useState("login");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPlayerA, setIsPlayerA] = useState(false);

  // 游戏选择相关状态
  const [choice, setChoice] = useState("");
  const [message, setMessage] = useState("");
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [opponentMessage, setOpponentMessage] = useState("");
  const [opponentConfirmed, setOpponentConfirmed] = useState(false);

  // 倒计时和结果相关状态
  const [gameCountdown, setGameCountdown] = useState(30);
  const [resultCountdown, setResultCountdown] = useState(3);
  const [resultStep, setResultStep] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const choices = ["Rock", "Paper", "Scissors"];

  // 🔍 验证房间代码
  const validateRoomCode = (code) => {
    return code.length === 4;
  };

  // 🎮 创建房间
  const handleCreateRoom = async () => {
    try {
      if (!name) {
        setError("Please enter your name");
        return;
      }
      if (!validateRoomCode(roomCode)) {
        setError("Room code must be 4 characters");
        return;
      }

      setLoading(true);
      setError("");
      
      const roomRef = ref(db, `rooms/${roomCode}`);
      await remove(roomRef); // 清除旧房间数据
      await update(roomRef, {
        playerA: name,
        createdAt: new Date().toISOString(),
        status: "waiting"
      });
      
      setIsPlayerA(true);
      setStep("waiting");
    } catch (err) {
      setError("Failed to create room: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🎮 加入房间
  const handleJoinRoom = async () => {
    try {
      if (!name) {
        setError("Please enter your name");
        return;
      }
      if (!validateRoomCode(roomCode)) {
        setError("Room code must be 4 characters");
        return;
      }

      setLoading(true);
      setError("");

      const roomRef = ref(db, `rooms/${roomCode}`);
      const snapshot = await get(roomRef);
      
      if (!snapshot.exists()) {
        setError("Room not found");
        return;
      }

      const roomData = snapshot.val();
      if (roomData.status !== "waiting") {
        setError("Room is no longer available");
        return;
      }

      await update(roomRef, {
        playerB: name,
        joinedAt: new Date().toISOString(),
        status: "playing"
      });

      setIsPlayerA(false);
      setOpponentName(roomData.playerA);
      setStep("game");
      setGameCountdown(30);
    } catch (err) {
      setError("Failed to join room: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 震动动画效果
  const startShaking = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500); // 0.5秒后停止震动
  };
  // 🎮 选择动作
const handleChoiceSelection = (selectedChoice) => {
  if (!hasConfirmed) {
    setChoice(selectedChoice);
  }
};

// 🎮 确认选择
const handleConfirm = async () => {
  if (!choice || hasConfirmed) return;

  try {
    const playerKey = isPlayerA ? "playerA" : "playerB";
    const playerData = {
      choice,
      message,
      confirmed: true,
      submittedAt: new Date().toISOString()
    };

    await update(ref(db, `rooms/${roomCode}/${playerKey}`), playerData);
    setHasConfirmed(true);
  } catch (err) {
    setError("Failed to confirm choice: " + err.message);
  }
};

// 🎮 获取游戏结果
const getResult = () => {
  if (!opponentChoice) return "Waiting...";
  if (choice === opponentChoice) return "It's a tie!";
  if (
    (choice === "Rock" && opponentChoice === "Scissors") ||
    (choice === "Paper" && opponentChoice === "Rock") ||
    (choice === "Scissors" && opponentChoice === "Paper")
  ) {
    return "You Win!";
  }
  return "You Lose!";
};

// 🔄 重置游戏并清除房间数据
const resetGame = async () => {
  try {
    if (roomCode) {
      await remove(ref(db, `rooms/${roomCode}`));
    }
  } catch (err) {
    console.error("Failed to cleanup room:", err);
  }

  setStep("login");
  setName("");
  setRoomCode("");
  setChoice("");
  setMessage("");
  setHasConfirmed(false);
  setOpponentName("");
  setOpponentChoice(null);
  setOpponentMessage("");
  setOpponentConfirmed(false);
  setGameCountdown(30);
  setResultCountdown(3);
  setResultStep(0);
  setIsShaking(false);
  setGameStarted(false);
  setIsPlayerA(false);
  setError("");
};

// 👀 监听房间状态和对手
useEffect(() => {
  if (step === "waiting" || step === "game") {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (step === "waiting" && data.status === "playing") {
        setOpponentName(data.playerB);
        setStep("game");
        setGameCountdown(30);
      }

      const opponentKey = isPlayerA ? "playerB" : "playerA";
      if (data[opponentKey]?.confirmed) {
        setOpponentConfirmed(true);
        setOpponentChoice(data[opponentKey].choice);
        setOpponentMessage(data[opponentKey].message || "");
      }
    });

    return () => unsubscribe();
  }
}, [step, roomCode, isPlayerA]);

// ⏳ 游戏选择倒计时
useEffect(() => {
  let timer;
  if (step === "game" && !gameStarted && gameCountdown > 0) {
    timer = setInterval(() => {
      setGameCountdown((prev) => {
        if (prev <= 1) {
          if (!hasConfirmed) {
            handleConfirm();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }
  return () => clearInterval(timer);
}, [step, gameStarted, gameCountdown, hasConfirmed]);

// 🎮 检查游戏是否结束
useEffect(() => {
  if (step === "game" && (hasConfirmed && opponentConfirmed || gameCountdown === 0)) {
    setGameStarted(true);
    setStep("result");
    setResultStep(0);
  }
}, [hasConfirmed, opponentConfirmed, gameCountdown, step]);

// ⏳ 结果逐步显示效果
useEffect(() => {
  let timer;
  if (step === "result") {
    if (resultCountdown > 0) {
      timer = setInterval(() => {
        setResultCountdown(prev => prev - 1);
      }, 1000);
    } else if (resultStep < 4) {
      timer = setTimeout(() => {
        setResultStep(prev => {
          if (prev < 4) {
            startShaking();
            return prev + 1;
          }
          return prev;
        });
      }, 1000);
    }
  }
  return () => {
    clearInterval(timer);
    clearTimeout(timer);
  };
}, [step, resultCountdown, resultStep]);

return (
  <div className="app-container">
    <div className="max-width-container">
      <div className="center-column">
        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {step === "login" && (
          <div className="center-column">
            <h1 className="title">Rock Paper Scissors</h1>
            <p className="subtitle">
              Create a room by entering a 4-character room code (numbers or letters). 
              Others can join your room by entering the same code.
            </p>
            <input
              type="text"
              placeholder="Your Name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
            <input
              type="text"
              placeholder="Room Code (4 characters)"
              className="input"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
              disabled={loading}
            />
            <button 
              onClick={handleCreateRoom}
              className={`button button-blue ${loading ? 'disabled' : ''}`}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button 
              onClick={handleJoinRoom}
              className={`button button-green ${loading ? 'disabled' : ''}`}
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        )}

        {step === "waiting" && (
          <div className="center-column">
            <h1 className="title">Waiting for opponent...</h1>
            <p className="room-code">Room Code: {roomCode}</p>
          </div>
        )}

        {step === "game" && (
          <div className="center-column">
            <h1 className="title">Make Your Move</h1>
            <p className="subtitle">
              Your message will only be shown if you win or tie the game.
            </p>
            <p className="opponent-name">Your opponent: {opponentName}</p>
            {!gameStarted && (
              <div className="countdown">
                Time remaining: {gameCountdown} seconds
              </div>
            )}
            <div className="choices-container">
              {choices.map((c) => (
                <button
                  key={c}
                  className={`button ${
                    choice === c ? 'button-green' : 'button-gray'
                  } ${hasConfirmed ? 'disabled' : ''}`}
                  onClick={() => handleChoiceSelection(c)}
                  disabled={hasConfirmed}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Message to opponent"
              className="input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={hasConfirmed}
            />
            <button 
              onClick={handleConfirm}
              disabled={!choice || hasConfirmed}
              className={`button button-blue ${(!choice || hasConfirmed) ? 'disabled' : ''}`}
            >
              {hasConfirmed ? 'Waiting for opponent...' : 'Confirm'}
            </button>
            
            {hasConfirmed && !opponentConfirmed && (
              <p className="waiting-message">
                Waiting for opponent to confirm...
              </p>
            )}
            {opponentConfirmed && !hasConfirmed && (
              <p className="waiting-message">
                Opponent has made their choice!
              </p>
            )}
          </div>
        )}

        {step === "result" && (
          <div className="center-column">
            {resultCountdown > 0 ? (
              <h1 className="title">
                Revealing in {resultCountdown}...
              </h1>
            ) : (
              <div className={`result-container ${isShaking ? 'shake' : ''}`}>
                <h2 className="result-title">Results:</h2>
                
                {resultStep >= 1 && (
                  <p className="fade-in">
                    <strong>You</strong> chose: {choice}
                  </p>
                )}
                
                {resultStep >= 2 && (
                  <p className="fade-in">
                    <strong>{opponentName}</strong> chose: {opponentChoice}
                  </p>
                )}
                
                {resultStep >= 3 && (
                  <p className="result-text fade-in">
                    {getResult()}
                  </p>
                )}
                
                {resultStep >= 4 && (
                  <>
                    {getResult() === "It's a tie!" ? (
                      <>
                        {message && (
                          <p className="message fade-in">
                            "{message}" - by <strong>You</strong>
                          </p>
                        )}
                        {opponentMessage && (
                          <p className="message fade-in">
                            "{opponentMessage}" - by <strong>{opponentName}</strong>
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        {getResult() === "You Win!" ? (
                          message && (
                            <p className="message fade-in">
                              "{message}" - by <strong>You</strong>
                            </p>
                          )
                        ) : (
                          opponentMessage && (
                            <p className="message fade-in">
                              "{opponentMessage}" - by <strong>{opponentName}</strong>
                            </p>
                          )
                        )}
                      </>
                    )}
                    <button 
                      onClick={resetGame}
                      className="button button-blue"
                    >
                      Play Again
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);
}
