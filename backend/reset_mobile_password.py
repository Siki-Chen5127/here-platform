from getpass import getpass
from sqlalchemy import select
from app.database import SessionLocal
from app.models import StudentUser
from app.security import hash_password


def main():
    phone = input("请输入需要重置的手机号：").strip()

    with SessionLocal() as session:
        user = session.scalar(
            select(StudentUser).where(StudentUser.phone == phone)
        )
        if user is None:
            print("未找到账号，没有修改数据。")
            return
        if user.status != "active":
            print("账号未启用，请先检查账号状态。")
            return

        print(f"目标账号：{user.phone}，名称：{user.display_name}")
        password = getpass("请输入新密码（8～128个字符）：")
        confirm = getpass("请再次输入新密码：")

        if not 8 <= len(password) <= 128:
            print("密码长度不符合要求，没有修改。")
            return
        if password != confirm:
            print("两次密码不一致，没有修改。")
            return
        if input("确认重置？输入 YES：").strip() != "YES":
            print("已取消，没有修改。")
            return

        user.password_hash = hash_password(password)
        session.commit()
        print("密码重置成功，请使用新密码登录手机 App。")


if __name__ == "__main__":
    main()