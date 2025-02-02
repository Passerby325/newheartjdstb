import { useState, useEffect, useCallback } from "react";
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

// 健康条组件
const HealthBar = ({ health, label }) => {
  // 确保生命值在有效范围内
  const validHealth = Math.min(5, Math.max(0, health));
  
  return (
    <div className="health-bar">
      <span className="health-label">{label}</span>
      <div className="health-points">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`health-point ${i < validHealth ? 'active' : ''}`}
          >
            ❤️
          </span>
        ))}
      </div>
      <span className="health-number">({validHealth}/5)</span>
    </div>
  );
};

export default function App() {
  // 基本游戏状态
  const [step, setStep] = useState("login");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPlayerA, setIsPlayerA] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

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

  // 生命值相关状态
  const [playerHealth, setPlayerHealth] = useState(5);
  const [opponentHealth, setOpponentHealth] = useState(5);

  const choices = ["Rock", "Paper", "Scissors"];

  // 🔍 验证房间代码
  const validateRoomCode = useCallback((code) => {
    return code.length === 4;
  }, []);

  // 震动动画效果
  const startShaking = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  // 🎮 更新游戏状态到 Firebase
  const updateGameState = useCallback(async (newPlayerHealth, newOpponentHealth) => {
    try {
      // 确保生命值在有效范围内
      const validPlayerHealth = Math.min(5, Math.max(0, newPlayerHealth));
      const validOpponentHealth = Math.min(5, Math.max(0, newOpponentHealth));

      const updates = {};
      if (isPlayerA) {
        updates[`rooms/${roomCode}/playerAHealth`] = validPlayerHealth;
        updates[`rooms/${roomCode}/playerBHealth`] = validOpponentHealth;
      } else {
        updates[`rooms/${roomCode}/playerBHealth`] = validPlayerHealth;
        updates[`rooms/${roomCode}/playerAHealth`] = validOpponentHealth;
      }
      
      if (validPlayerHealth === 0 || validOpponentHealth === 0) {
        updates[`rooms/${roomCode}/status`] = "gameover";
      }
      
      await update(ref(db), updates);
      console.log("Health updated:", { validPlayerHealth, validOpponentHealth });
      
      // 直接更新本地状态
      setPlayerHealth(validPlayerHealth);
      setOpponentHealth(validOpponentHealth);
    } catch (err) {
      console.error("Failed to update game state:", err);
      setError("Failed to update game state: " + err.message);
    }
  }, [roomCode, isPlayerA, db]);

  // 🎮 获取游戏结果
  const getResult = useCallback(() => {
    if (!opponentChoice) return "Waiting...";
    if (choice === opponentChoice) return "It's a tie!";
    
    const isWin = (choice === "Rock" && opponentChoice === "Scissors") ||
                  (choice === "Paper" && opponentChoice === "Rock") ||
                  (choice === "Scissors" && opponentChoice === "Paper");
    
    if (isWin) {
      if (opponentHealth <= 1) {
        return "You've Won The Game!";
      }
      return "You Win This Round!";
    } else {
      if (playerHealth <= 1) {
        return "Game Over - You Lost!";
      }
      return "You Lose This Round!";
    }
  }, [choice, opponentChoice, playerHealth, opponentHealth]);
  // 🎮 选择动作
  const handleChoiceSelection = useCallback((selectedChoice) => {
    if (!hasConfirmed) {
      setChoice(selectedChoice);
    }
  }, [hasConfirmed]);

  // 🎮 确认选择
  const handleConfirm = useCallback(async () => {
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
  }, [choice, hasConfirmed, isPlayerA, message, roomCode, db]);

  // 🎮 创建房间
  const handleCreateRoom = useCallback(async () => {
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
      
      // 检查房间是否已存在
      const snapshot = await get(roomRef);
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        if (roomData.status !== "gameover") {
          setError("Room already exists and is active");
          return;
        }
      }
      
      await remove(roomRef); // 清除旧房间数据
      
      const initialRoomData = {
        playerA: name,
        playerAHealth: 5,
        createdAt: new Date().toISOString(),
        status: "waiting",
        lastUpdateTime: new Date().toISOString()
      };
      
      await update(roomRef, initialRoomData);
      console.log("Room created:", initialRoomData);
      
      setIsPlayerA(true);
      setStep("waiting");
      setPlayerHealth(5);
      setOpponentHealth(5);
      setIsCalculating(false);
    } catch (err) {
      console.error("Failed to create room:", err);
      setError("Failed to create room: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [name, roomCode, db, validateRoomCode]);

  // 🎮 加入房间
  const handleJoinRoom = useCallback(async () => {
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

      const joinData = {
        playerB: name,
        playerBHealth: 5,
        joinedAt: new Date().toISOString(),
        status: "playing",
        lastUpdateTime: new Date().toISOString()
      };

      await update(roomRef, joinData);
      console.log("Joined room:", joinData);

      setIsPlayerA(false);
      setOpponentName(roomData.playerA);
      setStep("game");
      setGameCountdown(30);
      setPlayerHealth(5);
      setOpponentHealth(5);
      setIsCalculating(false);
    } catch (err) {
      console.error("Failed to join room:", err);
      setError("Failed to join room: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [name, roomCode, db, validateRoomCode]);

  // 🔄 开始下一轮
  const nextRound = useCallback(async () => {
    try {
      setIsCalculating(true); // 防止状态更新冲突

      // 保持当前生命值，重置其他游戏状态
      setChoice("");
      setMessage("");
      setHasConfirmed(false);
      setOpponentChoice(null);
      setOpponentMessage("");
      setOpponentConfirmed(false);
      setGameCountdown(30);
      setResultCountdown(3);
      setResultStep(0);
      setIsShaking(false);
      setGameStarted(false);
      
      // 更新房间状态
      const updates = {
        [`rooms/${roomCode}/playerA/confirmed`]: false,
        [`rooms/${roomCode}/playerA/choice`]: null,
        [`rooms/${roomCode}/playerA/message`]: "",
        [`rooms/${roomCode}/playerB/confirmed`]: false,
        [`rooms/${roomCode}/playerB/choice`]: null,
        [`rooms/${roomCode}/playerB/message`]: "",
        [`rooms/${roomCode}/status`]: "playing",
        [`rooms/${roomCode}/lastUpdateTime`]: new Date().toISOString()
      };
      
      await update(ref(db), updates);
      console.log("Starting next round, health:", { playerHealth, opponentHealth });
      setStep("game");
    } catch (err) {
      console.error("Failed to start next round:", err);
      setError("Failed to start next round: " + err.message);
    } finally {
      setIsCalculating(false);
    }
  }, [roomCode, db, playerHealth, opponentHealth]);

  // 🔄 重置游戏并清除房间数据
  const resetGame = useCallback(async () => {
    try {
      if (roomCode) {
        await remove(ref(db, `rooms/${roomCode}`));
        console.log("Room cleared:", roomCode);
      }
    } catch (err) {
      console.error("Failed to cleanup room:", err);
    }

    // 完全重置所有状态
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
    setPlayerHealth(5);
    setOpponentHealth(5);
    setIsCalculating(false);
  }, [roomCode, db]);

// 👀 监听房间状态和对手
  useEffect(() => {
    if (step === "waiting" || step === "game" || step === "result") {
      const roomRef = ref(db, `rooms/${roomCode}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          console.log("No room data found");
          return;
        }

        // 检查房间是否仍然有效
        const now = new Date();
        const lastUpdate = new Date(data.lastUpdateTime || data.createdAt);
        const timeDiff = now - lastUpdate;
        
        // 如果超过5分钟没有更新，认为房间已失效
        if (timeDiff > 5 * 60 * 1000) {
          console.log("Room expired, cleaning up...");
          resetGame();
          return;
        }

        // 首先更新房间状态
        if (step === "waiting" && data.status === "playing") {
          setOpponentName(data.playerB);
          setStep("game");
          setGameCountdown(30);
        }

        // 强制同步生命值，不管是否在计算中
        const currentPlayerHealth = isPlayerA ? data.playerAHealth : data.playerBHealth;
        const currentOpponentHealth = isPlayerA ? data.playerBHealth : data.playerAHealth;
        
        console.log("Room state update:", {
          currentPlayerHealth,
          currentOpponentHealth,
          isPlayerA,
          step,
          status: data.status
        });

        // 确保生命值在有效范围内（0-5）并更新
        if (typeof currentPlayerHealth === 'number') {
          const validPlayerHealth = Math.min(5, Math.max(0, currentPlayerHealth));
          if (validPlayerHealth !== playerHealth) {
            setPlayerHealth(validPlayerHealth);
          }
        }
        
        if (typeof currentOpponentHealth === 'number') {
          const validOpponentHealth = Math.min(5, Math.max(0, currentOpponentHealth));
          if (validOpponentHealth !== opponentHealth) {
            setOpponentHealth(validOpponentHealth);
          }
        }

        // 更新对手信息
        const opponentKey = isPlayerA ? "playerB" : "playerA";
        if (data[opponentKey]?.confirmed) {
          setOpponentConfirmed(true);
          setOpponentChoice(data[opponentKey].choice);
          setOpponentMessage(data[opponentKey].message || "");
        }

        // 检查游戏是否结束
        if (data.status === "gameover") {
          setGameStarted(true);
          setStep("result");
        }
      });

      return () => unsubscribe();
    }
  }, [step, roomCode, isPlayerA, playerHealth, opponentHealth, resetGame]);

  // 🎮 检查游戏结束并更新生命值
  useEffect(() => {
    const updateGameResults = async () => {
      if (isCalculating) {
        console.log("Already calculating results, skipping...");
        return;
      }

      setIsCalculating(true);
      console.log("Starting result calculation...");

      try {
        if (!choice || !opponentChoice) {
          console.log("Missing choices, skipping calculation");
          setGameStarted(true);
          setStep("result");
          setResultStep(0);
          return;
        }

        if (choice === opponentChoice) {
          console.log("Tie game");
          setGameStarted(true);
          setStep("result");
          setResultStep(0);
          return;
        }

        const isWin = (choice === "Rock" && opponentChoice === "Scissors") ||
                     (choice === "Paper" && opponentChoice === "Rock") ||
                     (choice === "Scissors" && opponentChoice === "Paper");

        // 确保当前生命值正确
        const currentPlayerHealth = Math.min(5, Math.max(0, playerHealth));
        const currentOpponentHealth = Math.min(5, Math.max(0, opponentHealth));

        // 计算新的生命值
        const newPlayerHealth = isWin ? currentPlayerHealth : Math.max(0, currentPlayerHealth - 1);
        const newOpponentHealth = isWin ? Math.max(0, currentOpponentHealth - 1) : currentOpponentHealth;

        console.log("Game result calculation:", {
          isWin,
          choice,
          opponentChoice,
          currentHealth: { player: currentPlayerHealth, opponent: currentOpponentHealth },
          newHealth: { player: newPlayerHealth, opponent: newOpponentHealth }
        });

        const updates = {};
        if (isPlayerA) {
          updates[`rooms/${roomCode}/playerAHealth`] = newPlayerHealth;
          updates[`rooms/${roomCode}/playerBHealth`] = newOpponentHealth;
        } else {
          updates[`rooms/${roomCode}/playerBHealth`] = newPlayerHealth;
          updates[`rooms/${roomCode}/playerAHealth`] = newOpponentHealth;
        }

        // 更新最后活动时间
        updates[`rooms/${roomCode}/lastUpdateTime`] = new Date().toISOString();

        if (newPlayerHealth === 0 || newOpponentHealth === 0) {
          updates[`rooms/${roomCode}/status`] = "gameover";
        }

        await update(ref(db), updates);
        console.log("Firebase updated with:", updates);

        // 仅在值真正改变时更新状态
        if (newPlayerHealth !== playerHealth) {
          setPlayerHealth(newPlayerHealth);
        }
        if (newOpponentHealth !== opponentHealth) {
          setOpponentHealth(newOpponentHealth);
        }

      } catch (err) {
        console.error("Failed to update game state:", err);
        setError("Failed to update game state: " + err.message);
      } finally {
        console.log("Calculation completed");
        setIsCalculating(false);
        setGameStarted(true);
        setStep("result");
        setResultStep(0);
      }
    };

    if (step === "game" && (hasConfirmed && opponentConfirmed || gameCountdown === 0)) {
      updateGameResults();
    }
  }, [hasConfirmed, opponentConfirmed, gameCountdown, step, choice, opponentChoice, 
      playerHealth, opponentHealth, roomCode, isPlayerA, isCalculating]);

  // 渲染健康状态栏
  const renderHealthBars = () => (
    <div className="health-display">
      <HealthBar 
        health={playerHealth} 
        label="Your Health:"
      />
      {opponentName && (
        <HealthBar 
          health={opponentHealth} 
          label={`${opponentName}'s Health:`}
        />
      )}
    </div>
  );

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
                Create a room by entering a 4-character room code. 
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
              {renderHealthBars()}
            </div>
          )}

          {(step === "game" || step === "result") && (
            <div className="center-column">
              <h1 className="title">{step === "game" ? "Make Your Move" : "Results"}</h1>
              {renderHealthBars()}

              {step === "game" && (
                <>
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
                </>
              )}

              {step === "result" && (
                <>
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
                          {choice === opponentChoice ? (
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
                              {getResult().includes("Win") ? (
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
                          {(playerHealth === 0 || opponentHealth === 0) ? (
                            <button 
                              onClick={resetGame}
                              className="button button-blue"
                            >
                              Start New Game
                            </button>
                          ) : (
                            <button 
                              onClick={nextRound}
                              className="button button-green"
                            >
                              Next Round
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
