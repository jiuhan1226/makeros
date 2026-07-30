import { useEffect, useRef, useState } from "react";

const COLORS = ["#182230", "#e23d3d", "#1677d2", "#1b9b67"];

export default function ExamScratchpad({ active = true }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const drawingRef = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [hasInk, setHasInk] = useState(false);

  function renderCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokesRef.current) {
      if (!stroke.points.length) continue;
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.tool === "eraser" ? 24 : 2.6;
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * rect.width;
        const y = point.y * rect.height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(renderCanvas) : null;
    observer?.observe(canvas);
    window.addEventListener("resize", renderCanvas);
    const id = window.requestAnimationFrame(renderCanvas);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", renderCanvas);
      window.cancelAnimationFrame(id);
    };
  }, [active]);

  function pointFromEvent(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function startDrawing(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const stroke = { tool, color, points: [pointFromEvent(event)] };
    strokesRef.current.push(stroke);
    drawingRef.current = stroke;
    setHasInk(true);
    renderCanvas();
  }

  function continueDrawing(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current.points.push(pointFromEvent(event));
    renderCanvas();
  }

  function stopDrawing(event) {
    if (!drawingRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    drawingRef.current = null;
  }

  function clearCanvas() {
    strokesRef.current = [];
    drawingRef.current = null;
    setHasInk(false);
    renderCanvas();
  }

  return (
    <section className="exam-scratchpad" aria-label="시험 필기 노트">
      <div className="scratchpad-toolbar">
        <div className="scratchpad-tools" role="group" aria-label="필기 도구">
          <button type="button" className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}>펜</button>
          <button type="button" className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}>지우개</button>
        </div>
        <div className="scratchpad-colors" aria-label="펜 색상">
          {COLORS.map((item) => (
            <button
              type="button"
              key={item}
              className={color === item && tool === "pen" ? "active" : ""}
              style={{ "--scratch-color": item }}
              onClick={() => { setColor(item); setTool("pen"); }}
              aria-label={`${item} 색상 선택`}
            />
          ))}
        </div>
        <button type="button" className="scratchpad-clear" onClick={clearCanvas} disabled={!hasInk}>전체 지우기</button>
      </div>
      <div className="scratchpad-canvas-wrap">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        {!hasInk && <p>계산식이나 핵심 내용을 자유롭게 적어보세요.</p>}
      </div>
      <small>필기 내용은 현재 브라우저에서 시험을 푸는 동안만 유지됩니다.</small>
    </section>
  );
}
