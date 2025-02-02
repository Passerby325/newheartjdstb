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

  const [playerReady, setPlayerReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

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
      
      if (newPlayerHealth <= 0 || newOpponentHealth <= 0) {
        updates[`rooms/${roomCode}/status`] = "gameover";
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
      const newOpponentHealth = opponentHealth - 1;
      if (newOpponentHealth <= 0) {
        return "You've Won The Game!";
      }
      return "You Win This Round!";
    } else {
      const newPlayerHealth = playerHealth - 1;
      if (newPlayerHealth <= 0) {
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
      // 标记本玩家已准备好
      const playerKey = isPlayerA ? "playerAReady" : "playerBReady";
      await update(ref(db, `rooms/${roomCode}`), { [playerKey]: true });
      setPlayerReady(true);
    } catch (err) {
      setError("Failed to start next round: " + err.message);
    }
  }, [roomCode, isPlayerA, db]);

  // 🔄 更新下一轮游戏状态
  const handleNextRound = useCallback(async () => {
    try {
      // 重置游戏相关状态, 保持房间和玩家信息
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
      setPlayerReady(false);
      setOpponentReady(false);
      
      // 更新房间状态
      const updates = {
        [`rooms/${roomCode}/playerA/confirmed`]: false,
        [`rooms/${roomCode}/playerA/choice`]: null,
        [`rooms/${roomCode}/playerA/message`]: "",
        [`rooms/${roomCode}/playerB/confirmed`]: false,
        [`rooms/${roomCode}/playerB/choice`]: null,
        [`rooms/${roomCode}/playerB/message`]: "",
        [`rooms/${roomCode}/playerAReady`]: false,
        [`rooms/${roomCode}/playerBReady`]: false,
        [`rooms/${roomCode}/status`]: "playing"
      };

      await update(ref(db), updates);
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
    setPlayerReady(false);
    setOpponentReady(false);
  }, [roomCode, db]);

// 👀 监听房间状态和对手
  useEffect(() => {
    if (step === "waiting" || step === "game" || step === "result") {
      const roomRef = ref(db, `rooms/${roomCode}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (step === "waiting" && data.status === "playing") {
          setOpponentName(data.playerB);
          setStep("game");
          setGameCountdown(30);
        }

        // 更新生命值
        if (isPlayerA) {
          setPlayerHealth(data.playerAHealth || 5);
          setOpponentHealth(data.playerBHealth || 5);
        } else {
          setPlayerHealth(data.playerBHealth || 5);
          setOpponentHealth(data.playerAHealth || 5);
        }

        // 更新对手信息
        const opponentKey = isPlayerA ? "playerB" : "playerA";
        if (data[opponentKey]?.confirmed) {
          setOpponentConfirmed(true);
          setOpponentChoice(data[opponentKey].choice);
          setOpponentMessage(data[opponentKey].message || "");
        }

        // 检查对手是否准备好进行下一轮
        if (data.playerAReady) setOpponentReady(true);
        if (data.playerBReady) setOpponentReady(true);

        // 检查双方是否都准备好进行下一轮
        if (data.playerAReady && data.playerBReady) {
          handleNextRound();
        }
      });

      return () => unsubscribe();
    }
  }, [step, roomCode, isPlayerA, db, handleNextRound]);

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
  }, [step, resultCountdown, resultStep, startShaking]);

  // 🎮 检查游戏结束并更新生命值
  useEffect(() => {
    const updateHealthAndGameState = async (isGameWin) => {
      let newPlayerHealth = playerHealth;
      let newOpponentHealth = opponentHealth;

      if (isGameWin) {
        newOpponentHealth -= 1;
      } else {
        newPlayerHealth -= 1;
      }

      // 更新 Firebase
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
      
      // 更新本地状态
      setPlayerHealth(newPlayerHealth);
      setOpponentHealth(newOpponentHealth);
    };

    if (step === "game" && (hasConfirmed && opponentConfirmed || gameCountdown === 0)) {
      if (choice && opponentChoice && choice !== opponentChoice) {
        const isWin = (choice === "Rock" && opponentChoice === "Scissors") ||
                     (choice === "Paper" && opponentChoice === "Rock") ||
                     (choice === "Scissors" && opponentChoice === "Paper");
        
        updateHealthAndGameState(isWin);
      }

      setGameStarted(true);
      setStep("result");
      setResultStep(0);
    }
  }, [hasConfirmed, opponentConfirmed, gameCountdown, step, choice, opponentChoice, 
      playerHealth, opponentHealth, roomCode, isPlayerA, db]);

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
