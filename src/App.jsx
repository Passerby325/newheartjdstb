import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get, remove } from "firebase/database";

// 🔥 Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyCLAFXiOEs5yeVH_EPGFm1yq5Y9CGWNM1I",
  authDomain: "jdstb-heart.firebaseapp.com",
  databaseURL: "https://jdstb-heart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jdstb-heart",
  storageBucket: "jdstb-heart.firebasestorage.app",
  messagingSenderId: "689147472667",
  appId: "1:689147472667:web:f5130e6a7cc132e73fc1be"
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
      const updates = {};
      if (isPlayerA) {
        updates[`rooms/${roomCode}/playerAHealth`] = newPlayerHealth;
        updates[`rooms/${roomCode}/playerBHealth`] = newOpponentHealth;
      } else {
        updates[`rooms/${roomCode}/playerBHealth`] = newPlayerHealth;
        updates[`rooms/${roomCode}/playerAHealth`] = newOpponentHealth;
      }
      await update(ref(db), updates);
    } catch (err) {
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
      return "You Win This Round!";
    } else {
      return "You Lose This Round!";
    }
  }, [choice, opponentChoice]);

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
      await remove(roomRef); // 清除旧房间数据
      await update(roomRef, {
        playerA: name,
        playerAHealth: 5,
        createdAt: new Date().toISOString(),
        status: "waiting"
      });
      
      setIsPlayerA(true);
      setStep("waiting");
      setPlayerHealth(5);
      setOpponentHealth(5);
    } catch (err) {
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

      await update(roomRef, {
        playerB: name,
        playerBHealth: 5,
        joinedAt: new Date().toISOString(),
        status: "playing"
      });

      setIsPlayerA(false);
      setOpponentName(roomData.playerA);
      setStep("game");
      setGameCountdown(30);
      setPlayerHealth(5);
      setOpponentHealth(5);
    } catch (err) {
      setError("Failed to join room: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [name, roomCode, db, validateRoomCode]);

  // 🔄 开始下一轮
  const nextRound = useCallback(async () => {
    try {
      const updates = {
        [`rooms/${roomCode}/playerA/nextRound`]: true,
        [`rooms/${roomCode}/playerB/nextRound`]: true,
        [`rooms/${roomCode}/status`]: "playing"
      };
      
      await update(ref(db), updates);

      // 本地状态重置
      setChoice("");
      setMessage("");
      setHasConfirmed(false);
      setOpponentChoice(null);
      setOpponentMessage("");
      setOpponentConfirmed(false);
      setGameCountdown(30);
      setResultCountdown(3);
      setResultStep(0);
      setStep("game");

    } catch (err) {
      setError("Failed to start next round: " + err.message);
    }
  }, [roomCode, db]);

  // 🔄 重置游戏并清除房间数据
  const resetGame = useCallback(async () => {
    try {
      if (roomCode) {
        await remove(ref(db, `rooms/${roomCode}`));
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
  }, [roomCode, db]);

  // 👀 监听房间状态和对手
  useEffect(() => {
    if (step === "waiting" || step === "game" || step === "result") {
      const roomRef = ref(db, `rooms/${roomCode}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // 处理等待房间状态
        if (step === "waiting" && data.status === "playing") {
          setOpponentName(data.playerB);
          setStep("game");
          setGameCountdown(30);
        }

        // 统一处理生命值更新
        const shouldUpdateHealth = 
          data.playerAHealth !== undefined && 
          data.playerBHealth !== undefined;
          
        if (shouldUpdateHealth) {
          setPlayerHealth(isPlayerA ? data.playerAHealth : data.playerBHealth);
          setOpponentHealth(isPlayerA ? data.playerBHealth : data.playerAHealth);
        }

        // 处理游戏结束状态
        if (data.status === "gameover") {
          setStep("result");
          setResultStep(4); // 直接显示最终结果
        }

        const opponentKey = isPlayerA ? "playerB" : "playerA";
        if (data[opponentKey]?.confirmed) {
          setOpponentConfirmed(true);
          setOpponentChoice(data[opponentKey].choice);
          setOpponentMessage(data[opponentKey].message || "");
        }

        if (data.playerA?.nextRound && data.playerB?.nextRound) {
          // 重置游戏相关状态
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
          const resetUpdates = {
            [`rooms/${roomCode}/playerA/nextRound`]: false,
            [`rooms/${roomCode}/playerB/nextRound`]: false,
            [`rooms/${roomCode}/playerA/confirmed`]: false,
            [`rooms/${roomCode}/playerA/choice`]: null,
            [`rooms/${roomCode}/playerA/message`]: "",
            [`rooms/${roomCode}/playerB/confirmed`]: false,
            [`rooms/${roomCode}/playerB/choice`]: null,
            [`rooms/${roomCode}/playerB/message`]: "",
            [`rooms/${roomCode}/status`]: "playing"
          };
          update(ref(db), resetUpdates);
          setStep("game");
        }
      });

      return () => unsubscribe();
    }
  }, [step, roomCode, isPlayerA, db]);

  // ⏳ 游戏选择倒计时
  useEffect(() => {
    let timer;
    if (step === "game" && !gameStarted && gameCountdown > 0) {
      timer = setInterval(() => {
        setGameCountdown((prev) => {
          if (prev <= 1) {
            if (!hasConfirmed && choice) {
              handleConfirm();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, gameStarted, gameCountdown, hasConfirmed, choice, handleConfirm]);

  // ⏳ 结果展示倒计时
  useEffect(() => {
    let timer;
    if (step === "result") {
      if (resultCountdown > 0) {
        timer = setInterval(() => {
          setResultCountdown(prev => prev - 1);
        }, 1000);
      } else if (resultStep < 6) {
        timer = setTimeout(() => {
          setResultStep(prev => {
            const nextStep = prev + 1;
            if (nextStep === 5) {
              // 检查游戏结束条件
              if (playerHealth <= 0 || opponentHealth <= 0) {
                return 6; // 直接跳转到最终结果
              }
            }
            return nextStep;
          });
          startShaking();
        }, 1000);
      }
    }
    return () => {
      clearInterval(timer);
      clearTimeout(timer);
    };
  }, [step, resultCountdown, resultStep, playerHealth, opponentHealth]);

 // 🎮 检查游戏结束并更新生命值
  useEffect(() => {
    const updateHealthAndGameState = async () => {
      if (!choice || !opponentChoice) return;
      if (step !== "game") return;

      let newPlayerHealth = playerHealth;
      let newOpponentHealth = opponentHealth;

      // 平局情况
      if (choice === opponentChoice) {
        console.log('平局，当前血量:', playerHealth, opponentHealth);
        // 只有当血量大于1时才扣血
        newPlayerHealth = playerHealth > 1 ? playerHealth - 1 : playerHealth;
        newOpponentHealth = opponentHealth > 1 ? opponentHealth - 1 : opponentHealth;
        console.log('平局后血量:', newPlayerHealth, newOpponentHealth);
      } else {
        // 胜负情况
        const isWin = (choice === "Rock" && opponentChoice === "Scissors") ||
                     (choice === "Paper" && opponentChoice === "Rock") ||
                     (choice === "Scissors" && opponentChoice === "Paper");
        
        if (isWin) {
          newOpponentHealth = Math.max(0, opponentHealth - 1);
        } else {
          newPlayerHealth = Math.max(0, playerHealth - 1);
        }
      }

      // 如果血量没有变化，直接返回
      if (newPlayerHealth === playerHealth && newOpponentHealth === opponentHealth) {
        setStep("result");
        setResultStep(0);
        return;
      }

      // 更新Firebase
      try {
        const updates = {};
        if (isPlayerA) {
          updates[`rooms/${roomCode}/playerAHealth`] = newPlayerHealth;
          updates[`rooms/${roomCode}/playerBHealth`] = newOpponentHealth;
        } else {
          updates[`rooms/${roomCode}/playerBHealth`] = newPlayerHealth;
          updates[`rooms/${roomCode}/playerAHealth`] = newOpponentHealth;
        }

        if (newPlayerHealth <= 0 || newOpponentHealth <= 0) {
          updates[`rooms/${roomCode}/status`] = "gameover";
        }

        await update(ref(db), updates);
        setPlayerHealth(newPlayerHealth);
        setOpponentHealth(newOpponentHealth);
        
      } catch (err) {
        setError("生命值更新失败: " + err.message);
      }

      setStep("result");
      setResultStep(0);
    };

    if (step === "game" && hasConfirmed && opponentConfirmed) {
      updateHealthAndGameState();
    }
  }, [hasConfirmed, opponentConfirmed]);

  const getResultMessage = () => {
    if (!choice || !opponentChoice) return "";
    
    // 平局情况
    if (choice === opponentChoice) {
      return (
        <div>
          <p>You both chose {choice}!</p>
          {message && <p>You said: {message}</p>}
          {opponentMessage && <p>Opponent said: {opponentMessage}</p>}
        </div>
      );
    }
    
    // 判断胜负
    const isWin = (choice === "Rock" && opponentChoice === "Scissors") ||
                  (choice === "Paper" && opponentChoice === "Rock") ||
                  (choice === "Scissors" && opponentChoice === "Paper");

    if (isWin) {
      return (
        <div>
          <p>You win! {choice} beats {opponentChoice}</p>
          {message && <p>You said: {message}</p>}
        </div>
      );
    } else {
      return (
        <div>
          <p>You lose! {opponentChoice} beats {choice}</p>
          {opponentMessage && <p>Opponent said: {opponentMessage}</p>}
        </div>
      );
    }
  };

  return (
    <div className="container">
      {step === "login" && (
        <>
          <h1>Rock Paper Scissors</h1>
          <p>Create a room by entering a 4-character room code. Others can join your room by entering the same code.</p>
          <p style={{color: '#FFD700'}}>This is a Rock Paper Scissors game with special rules:<br/>
          1) In case of a tie, both players lose 1 HP<br/>
          2) Players with only 1 HP left won't lose HP from ties</p>
        </>
      )}

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
              <div className="health-display">
                <div className="health-bar">
                  <span className="health-label">Your Health: ({playerHealth}/5)</span>
                </div>
              </div>
            </div>
          )}

          {step === "game" && (
            <div className="center-column">
              <h1 className="title">Make Your Move</h1>
              
              <div className="health-display">
                <div className="health-bar">
                  <span className="health-label">Your Health: ({playerHealth}/5)</span>
                </div>
                
                <div className="health-bar">
                  <span className="health-label">{opponentName}'s Health: ({opponentHealth}/5)</span>
                </div>
              </div>

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
                <h1 className="title">Revealing in {resultCountdown}...</h1>
              ) : (
                <div className={`result-container ${isShaking ? 'shake' : ''}`}>
                  <h2 className="result-title">Results:</h2>
                  
                  {/* Step 1: Show your choice */}
                  {resultStep >= 1 && (
                    <div className="fade-in">
                      <p>You chose: {choice}</p>
                    </div>
                  )}
                  
                  {/* Step 2: Show opponent's choice */}
                  {resultStep >= 2 && (
                    <div className="fade-in">
                      <p>Opponent chose: {opponentChoice}</p>
                    </div>
                  )}
                  
                  {/* Step 3: Show round result */}
                  {resultStep >= 3 && (
                    <div className="fade-in">
                      {choice === opponentChoice ? (
                        <p>It's a tie!</p>
                      ) : (
                        <p style={{ 
                          color: getResult() === "You Win This Round!" ? '#00FFFF' : '#FF0000'
                        }}>
                          {getResult()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Step 4: Show messages */}
                  {resultStep >= 4 && (
                    <div className="fade-in">
                      {choice === opponentChoice ? (
                        <>
                          {message && <p>"{message}" - by You</p>}
                          {opponentMessage && <p>"{opponentMessage}" - by Opponent</p>}
                        </>
                      ) : (
                        getResult() === "You Win This Round!" ? (
                          message && <p>"{message}" - by You</p>
                        ) : (
                          opponentMessage && <p>"{opponentMessage}" - by {opponentName}</p>
                        )
                      )}
                    </div>
                  )}
                  
                  {/* Step 5: Show health status */}
                  {resultStep >= 5 && (
                    <div className="health-status fade-in">
                      <p>Current Health Status:</p>
                      <p>You: {playerHealth}/5</p>
                      <p>{opponentName}: {opponentHealth}/5</p>
                    </div>
                  )}

                  {/* Game over or next round button */}
                  {resultStep >= 5 && (
                    <>
                      {(playerHealth <= 0 || opponentHealth <= 0) ? (
                        <>
                          <p className="result-text">GAME OVER!</p>
                          <button 
                            onClick={resetGame}
                            className="button button-blue"
                          >
                            Start New Game
                          </button>
                        </>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
