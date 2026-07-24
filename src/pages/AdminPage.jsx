export default function AdminPage() {
  return <main className="page-shell admin-native-shell">
    <div className="page-heading"><span className="eyebrow">ADMIN</span><h1>관리자 센터</h1><p>기존 자격증·시험·HTML·PDF·CSV 가져오기 기능을 MakerOS 관리자 화면 안에서 사용합니다.</p></div>
    <section className="panel admin-embed-panel">
      <iframe title="MakerOS 관리자 가져오기" src="/legacy.html?embed=1#admin" />
    </section>
  </main>;
}
