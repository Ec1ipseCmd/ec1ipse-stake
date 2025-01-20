"use client"; 
import "../styles.css";
import React, { useEffect } from 'react';

function StakingTimer({ 
    isStakeActive, 
    setIsStakeActive, 
    countdown, 
    setCountdown 
}) {
    useEffect(() => {
        const updateStakeAvailability = () => {
            const now = new Date();
            const secondsSinceTopOfHour = now.getMinutes() * 60 + now.getSeconds();
            const totalCycleDuration = 600;
            const activeDurationSeconds = 300;
            const secondsPastInterval = secondsSinceTopOfHour % totalCycleDuration;

            if (secondsPastInterval < activeDurationSeconds) {
                setIsStakeActive(true);
                setCountdown('');
            } else {
                setIsStakeActive(false);
            }

            let diff;
            if (secondsPastInterval < activeDurationSeconds) {
                diff = activeDurationSeconds - secondsPastInterval;
            } else {
                diff = totalCycleDuration - secondsPastInterval;
            }

            const diffMinutes = Math.floor(diff / 60);
            const diffSeconds = diff % 60;

            const countdownStr = `${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
            setCountdown(countdownStr);
        };

        updateStakeAvailability();

        const intervalId = setInterval(updateStakeAvailability, 1000);

        return () => clearInterval(intervalId);
    }, [setIsStakeActive, setCountdown]);

    return (
        <div className="staking-timer">
            {isStakeActive ? (
                <p className="stake-active">Stake Boost is no longer available, please unstake or wait for our 'Migrate' button.</p>
            ) : (
                countdown && <p className="stake-countdown">Stake Boost is no longer available, please unstake or wait for our 'Migrate' button.</p>
            )}
        </div>
    );
}

export default React.memo(StakingTimer);
