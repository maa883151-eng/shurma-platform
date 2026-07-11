import { useState } from 'react';
import api from '../api/axios';
import { BarChart3, CheckCircle2, Clock } from 'lucide-react';

export default function PollCard({ poll: initialPoll, postId }) {
  const [poll, setPoll] = useState(initialPoll);
  const [voting, setVoting] = useState(false);

  if (!poll) return null;

  const isEnded = poll.ends_at && new Date(poll.ends_at) < new Date();
  const showResults = poll.has_voted || isEnded;

  const vote = async (optionId) => {
    if (showResults || voting) return;
    setVoting(true);
    try {
      const { data } = await api.post(`/polls/${poll.id}/vote`, {
        option_ids: [optionId],
      });
      setPoll(data.poll);
    } catch (err) {
      console.error(err);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="mt-3 border border-gray-700 rounded-xl p-4 space-y-2 bg-gray-900/50">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
        <BarChart3 size={15} className="text-primary-400" />
        {poll.question}
      </div>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const myVote = poll.my_votes?.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => vote(opt.id)}
              disabled={showResults || voting}
              className="w-full text-left relative overflow-hidden rounded-lg border border-gray-700 hover:border-primary-500/60 transition-colors disabled:cursor-default"
            >
              {showResults && (
                <div
                  className="absolute inset-0 bg-primary-500/20 transition-all duration-500"
                  style={{ width: `${opt.pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between px-3 py-2">
                <span className={`text-sm ${myVote ? 'text-primary-300 font-medium' : 'text-gray-300'}`}>
                  {myVote && <CheckCircle2 size={12} className="inline mr-1.5 text-primary-400" />}
                  {opt.text}
                </span>
                {showResults && (
                  <span className="text-xs text-gray-400 ml-2 shrink-0">{opt.pct}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
        <span>{poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}</span>
        {poll.is_anonymous && <span>· Anonymous</span>}
        {poll.ends_at && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {isEnded ? 'Ended' : `Ends ${new Date(poll.ends_at).toLocaleDateString()}`}
          </span>
        )}
      </div>
    </div>
  );
}
