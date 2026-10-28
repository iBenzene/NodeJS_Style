export default function App() {
    const user = {
        age: 18,
        gender: 'female',
        name: 'Alice'
    };
    return <div className="message">{user.name}</div>;
}
