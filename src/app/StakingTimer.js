"use client";

import React, { useEffect } from 'react';
import './styles.css';

function StakingTimer({ isStakeActive, setIsStakeActive, countdown, setCountdown }) {
    useEffect(() => {
        const updateStakeAvailability = () => {
            const now = new Date();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();

            if (minutes < 5) {
                setIsStakeActive(true);
                setCountdown('');
            } else {
                setIsStakeActive(false);
                const nextHour = new Date(now.getTime());
                nextHour.setMinutes(0);
                nextHour.setSeconds(0);
                nextHour.setMilliseconds(0);
                nextHour.setHours(now.getHours() + 1);

                const diff = nextHour - now;

                const diffSeconds = Math.floor(diff / 1000) % 60;
                const diffMinutes = Math.floor(diff / (1000 * 60)) % 60;

                const countdownStr = `${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
                setCountdown(countdownStr);
            }
        };

        updateStakeAvailability();

        const intervalId = setInterval(updateStakeAvailability, 1000);

        return () => clearInterval(intervalId);
    }, [setIsStakeActive, setCountdown]);

    return (
        <div className="staking-timer">
            {isStakeActive ? (
                <p className="stake-active">Stake Boost is currently active.</p>
            ) : (
                countdown && <p className="stake-countdown">Stake Boost is available next in: {countdown}</p>
            )}
        </div>
    );
}

export default React.memo(StakingTimer);